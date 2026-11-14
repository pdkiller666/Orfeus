package ru.orfey.voice

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.KeyStore
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID
import java.util.concurrent.Executors
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties

/**
 * Direct-to-GitHub teacher sample uploads. No GitHub credential is exposed to JavaScript,
 * committed to the repository, or sent to a third-party server.
 */
class GitHubSamplesBridge(context: Context, private val webView: WebView) {
    private val appContext = context.applicationContext
    private val vault = TokenVault(appContext)
    private val executor = Executors.newSingleThreadExecutor()
    fun close() { executor.shutdownNow() }

    @JavascriptInterface
    fun appVersionCode(): Int = BuildConfig.VERSION_CODE

    @JavascriptInterface
    fun appVersionName(): String = BuildConfig.VERSION_NAME

    @JavascriptInterface
    fun openMicrophoneSettings(): Boolean {
        val intent = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", appContext.packageName, null)
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            appContext.startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            false
        }
    }

    @JavascriptInterface
    fun hasToken(): Boolean = vault.read() != null

    @JavascriptInterface
    fun saveToken(token: String) {
        val candidate = token.trim()
        if (candidate.length !in 20..512 || !candidate.startsWith("github_pat_") || candidate.any { it.isWhitespace() }) {
            postTokenResult(false, "", "Нужен fine-grained token GitHub с префиксом github_pat_.")
            return
        }
        executor.execute {
            try {
                val repo = api("GET", "/repos/$OWNER/$REPO", candidate)
                val permissions = repo.optJSONObject("permissions")
                if (permissions?.optBoolean("push", false) != true) {
                    throw IllegalStateException("У аккаунта нет права записи в pdkiller666/Orfeus. Владелец репозитория должен выдать доступ участника с правом Write.")
                }
                vault.write(candidate)
                postTokenResult(true, "", "Токен проверен и сохранён на этом устройстве.")
            } catch (e: Exception) {
                postTokenResult(false, "", readableError(e))
            }
        }
    }

    @JavascriptInterface
    fun forgetToken() {
        vault.clear()
        postTokenResult(false, "", "Доступ GitHub удалён с этого устройства.")
    }

    @JavascriptInterface
    fun submitSample(payloadText: String) {
        if (payloadText.length > MAX_REQUEST_CHARS) {
            postUploadResult(false, "", "Файл слишком большой. Максимальный размер исходной записи — 5 МБ.")
            return
        }
        executor.execute {
            var branch = ""
            try {
                val token = vault.read() ?: throw IllegalStateException("Сначала подключите GitHub-аккаунт преподавателя.")
                val input = JSONObject(payloadText)
                val exerciseId = input.optString("exerciseId")
                if (exerciseId !in EXERCISE_IDS) throw IllegalArgumentException("Неизвестное упражнение.")
                val sampleId = input.optString("id").takeIf { it.matches(Regex("[a-f0-9-]{36}")) } ?: UUID.randomUUID().toString()
                val title = input.optString("title").replace(Regex("\\s+"), " ").trim().take(80)
                val description = input.optString("description").trim().take(500)
                val recordedBy = input.optString("recordedBy").replace(Regex("\\s+"), " ").trim().take(60)
                val durationMs = input.optInt("durationMs", 0)
                if (title.length < 3) throw IllegalArgumentException("Название должно содержать не менее 3 символов.")
                if (recordedBy.length < 2) throw IllegalArgumentException("Укажите имя преподавателя или автора записи.")
                if (durationMs !in 500..30000) throw IllegalArgumentException("Длительность фрагмента должна быть от 0,5 до 30 секунд.")
                if (!input.optBoolean("consent", false)) throw IllegalArgumentException("Подтвердите права и согласие на публикацию записи.")
                val encoded = input.optString("wavBase64")
                val audio = try { Base64.decode(encoded, Base64.DEFAULT) } catch (_: Exception) { throw IllegalArgumentException("Не удалось прочитать аудиофайл.") }
                if (audio.isEmpty() || audio.size > MAX_AUDIO_BYTES) throw IllegalArgumentException("Размер WAV должен быть не больше 5 МБ.")
                if (audio.size < 44 || String(audio, 0, 4, StandardCharsets.US_ASCII) != "RIFF" || String(audio, 8, 4, StandardCharsets.US_ASCII) != "WAVE") {
                    throw IllegalArgumentException("Ожидается WAV-аудио.")
                }
                val wav = ByteBuffer.wrap(audio).order(ByteOrder.LITTLE_ENDIAN)
                val riffBytes = wav.getInt(4)
                val formatChunkBytes = wav.getInt(16)
                val format = wav.getShort(20).toInt() and 0xffff
                val channels = wav.getShort(22).toInt() and 0xffff
                val sampleRate = wav.getInt(24)
                val bitsPerSample = wav.getShort(34).toInt() and 0xffff
                val declaredDataBytes = wav.getInt(40)
                val actualDurationMs = if (sampleRate > 0) ((audio.size - 44) / 2.0 / sampleRate * 1000).toInt() else 0
                if (riffBytes != audio.size - 8 || formatChunkBytes != 16 || format != 1 || channels != 1 || sampleRate !in 8000..96000 || bitsPerSample != 16 ||
                    declaredDataBytes != audio.size - 44 || kotlin.math.abs(actualDurationMs - durationMs) > 100) {
                    throw IllegalArgumentException("Файл должен быть корректным моно PCM-16 WAV с длительностью, совпадающей с выбранным фрагментом.")
                }

                val repo = api("GET", "/repos/$OWNER/$REPO", token)
                if (repo.optJSONObject("permissions")?.optBoolean("push", false) != true) {
                    throw IllegalStateException("Для загрузки нужен GitHub-доступ Write к pdkiller666/Orfeus.")
                }
                val base = repo.optString("default_branch", "main")
                if (base != "main") throw IllegalStateException("Ожидалась основная ветка main; отправка остановлена для безопасности.")
                val ref = api("GET", "/repos/$OWNER/$REPO/git/ref/heads/$base", token)
                val baseSha = ref.getJSONObject("object").getString("sha")
                branch = "samples/upload-${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(8)}"
                api("POST", "/repos/$OWNER/$REPO/git/refs", token,
                    JSONObject().put("ref", "refs/heads/$branch").put("sha", baseSha))

                val manifestResponse = api("GET", "/repos/$OWNER/$REPO/contents/samples/manifest.json?ref=$base", token)
                val manifestBytes = Base64.decode(manifestResponse.optString("content").replace("\n", ""), Base64.DEFAULT)
                val manifest = JSONObject(String(manifestBytes, StandardCharsets.UTF_8))
                if (manifest.optInt("schema") != 1) throw IllegalStateException("Версия каталога образцов не поддерживается.")
                val samples = manifest.optJSONArray("samples") ?: JSONArray()
                if (samples.length() >= 100) throw IllegalStateException("Каталог достиг лимита в 100 образцов.")
                if ((0 until samples.length()).any { samples.getJSONObject(it).optString("id") == sampleId }) {
                    throw IllegalStateException("Образец с таким ID уже существует. Закройте редактор и повторите отправку.")
                }

                val path = "samples/audio/$sampleId.wav"
                val digest = MessageDigest.getInstance("SHA-256").digest(audio).joinToString("") { "%02x".format(it.toInt() and 0xff) }
                val createdAt = Instant.now().toString()
                val entry = JSONObject()
                    .put("id", sampleId)
                    .put("exerciseId", exerciseId)
                    .put("title", title)
                    .put("description", description)
                    .put("recordedBy", recordedBy)
                    .put("sourceType", "teacher")
                    .put("path", path)
                    .put("mimeType", "audio/wav")
                    .put("sha256", digest)
                    .put("sizeBytes", audio.size)
                    .put("durationMs", durationMs)
                    .put("license", "CC BY 4.0")
                    .put("createdAt", createdAt)
                    .put("status", "approved")
                samples.put(entry)
                manifest.put("samples", samples)
                manifest.put("updatedAt", createdAt)

                putFile(token, branch, path, "Добавлен аудиообразец $sampleId", Base64.encodeToString(audio, Base64.NO_WRAP))
                val manifestShaOnBranch = api("GET", "/repos/$OWNER/$REPO/contents/samples/manifest.json?ref=$branch", token).optString("sha")
                if (manifestShaOnBranch.isBlank()) throw IllegalStateException("Не удалось проверить каталог в новой ветке.")
                putFile(token, branch, "samples/manifest.json", "Обновлён каталог аудиообразцов", Base64.encodeToString(manifest.toString(2).toByteArray(StandardCharsets.UTF_8), Base64.NO_WRAP), manifestShaOnBranch)

                val pr = api("POST", "/repos/$OWNER/$REPO/pulls", token,
                    JSONObject()
                        .put("title", "Аудиообразец: ${exerciseLabel(exerciseId)} — $title".take(200))
                        .put("head", branch)
                        .put("base", base)
                        .put("draft", false)
                        .put("body", """Автоматически отправлено из приложения «Орфей».

Упражнение: ${exerciseLabel(exerciseId)} ($exerciseId)
Автор записи: $recordedBy
Лицензия: CC BY 4.0
Длительность: ${"%.1f".format(durationMs / 1000.0)} с
SHA-256: $digest

Предпрослушать публичную запись до слияния: https://raw.githubusercontent.com/$OWNER/$REPO/$branch/$path

Файл стал публичным сразу после отправки в ветку, ещё до этого PR. Проверьте аудио и описание. Слияние только добавит запись в каталог приложения."""))
                postUploadResult(true, pr.optString("html_url"), "Pull Request создан. WAV уже публичен в ветке; после проверки и слияния образец появится в каталоге приложения.")
            } catch (e: Exception) {
                if (branch.isNotBlank()) cleanupBranch(branch, vault.read())
                postUploadResult(false, "", readableError(e))
            }
        }
    }

    private fun putFile(token: String, branch: String, path: String, message: String, content: String, sha: String? = null) {
        val body = JSONObject().put("message", message).put("content", content).put("branch", branch)
        if (!sha.isNullOrBlank()) body.put("sha", sha)
        api("PUT", "/repos/$OWNER/$REPO/contents/$path", token, body)
    }

    private fun cleanupBranch(branch: String, token: String?) {
        if (token == null) return
        try { api("DELETE", "/repos/$OWNER/$REPO/git/refs/heads/$branch", token) } catch (_: Exception) { }
    }

    private fun api(method: String, path: String, token: String, body: JSONObject? = null): JSONObject {
        val connection = (URL("https://api.github.com$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 20000
            readTimeout = 60000
            setRequestProperty("Accept", "application/vnd.github+json")
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("X-GitHub-Api-Version", "2022-11-28")
            setRequestProperty("User-Agent", "Orfey-Android-Samples")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                val bytes = body.toString().toByteArray(StandardCharsets.UTF_8)
                setFixedLengthStreamingMode(bytes.size)
                outputStream.use { it.write(bytes) }
            }
        }
        try {
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.use { input ->
                val out = ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    if (out.size() + count > MAX_RESPONSE_BYTES) throw IllegalStateException("Ответ GitHub слишком велик.")
                    out.write(buffer, 0, count)
                }
                String(out.toByteArray(), StandardCharsets.UTF_8)
            }.orEmpty()
            if (status !in 200..299) {
                val message = try { JSONObject(text).optString("message") } catch (_: Exception) { "" }
                throw GitHubHttpException(status, message)
            }
            return if (text.isBlank()) JSONObject() else JSONObject(text)
        } finally { connection.disconnect() }
    }

    private fun postTokenResult(ok: Boolean, login: String, message: String) = onUi(
        "window.onGitHubTokenResult&&window.onGitHubTokenResult($ok,${JSONObject.quote(login)},${JSONObject.quote(message)})"
    )
    private fun postUploadResult(ok: Boolean, url: String, message: String) = onUi(
        "window.onSampleUploadResult&&window.onSampleUploadResult($ok,${JSONObject.quote(url)},${JSONObject.quote(message)})"
    )
    private fun onUi(script: String) { webView.post { webView.evaluateJavascript(script, null) } }

    private fun readableError(error: Exception): String = when (error) {
        is GitHubHttpException -> when (error.status) {
            401 -> "GitHub отклонил токен. Проверьте его срок действия и права."
            403 -> if (error.message.orEmpty().contains("rate limit", true)) "GitHub временно ограничил запросы. Попробуйте позже." else "GitHub отказал в доступе. Проверьте права Contents и Pull requests, а также доступ Write к репозиторию."
            404 -> "Не найдены репозиторий или samples/manifest.json. Проверьте доступ и каталог образцов."
            409, 422 -> "GitHub не принял изменение. Возможно, ветка или файл уже изменились; обновите приложение и повторите."
            else -> "Ошибка GitHub API (${error.status}). Попробуйте позже."
        }
        is IllegalArgumentException, is IllegalStateException -> error.message ?: "Проверьте данные образца."
        else -> "Не удалось связаться с GitHub. Проверьте интернет и попробуйте снова."
    }

    private fun exerciseLabel(id: String): String = EXERCISE_LABELS[id] ?: id

    private class GitHubHttpException(val status: Int, message: String) : Exception(message)

    private class TokenVault(context: Context) {
        private val prefs = context.getSharedPreferences("teacher_github_auth", Context.MODE_PRIVATE)
        private val alias = "orfey_github_token_key_v1"
        @Synchronized fun write(token: String) {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, key())
            val encrypted = cipher.doFinal(token.toByteArray(StandardCharsets.UTF_8))
            prefs.edit().putString("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
                .putString("data", Base64.encodeToString(encrypted, Base64.NO_WRAP)).apply()
        }
        @Synchronized fun read(): String? {
            return try {
                val iv = prefs.getString("iv", null) ?: return null
                val data = prefs.getString("data", null) ?: return null
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
                String(cipher.doFinal(Base64.decode(data, Base64.NO_WRAP)), StandardCharsets.UTF_8)
            } catch (_: Exception) { clear(); null }
        }
        @Synchronized fun clear() { prefs.edit().clear().apply() }
        private fun key(): SecretKey {
            val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            (store.getKey(alias, null) as? SecretKey)?.let { return it }
            val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
            generator.init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build())
            return generator.generateKey()
        }
    }

    companion object {
        private const val OWNER = "pdkiller666"
        private const val REPO = "Orfeus"
        private const val MAX_AUDIO_BYTES = 5 * 1024 * 1024
        private const val MAX_REQUEST_CHARS = 8 * 1024 * 1024
        private const val MAX_RESPONSE_BYTES = 12 * 1024 * 1024
        private val EXERCISE_IDS = setOf("range", "one", "step", "fal", "dyn", "pop", "vib", "belt", "tw", "grit", "mel", "sub", "game", "vib2", "fal2", "tw2", "belt2", "mel2", "sub2")
        private val EXERCISE_LABELS = mapOf(
            "range" to "Диагностика диапазона", "one" to "Одна нота", "step" to "Ступенька до-ре-до", "fal" to "Фальцет", "dyn" to "Динамика", "pop" to "Поп-фильтр", "vib" to "Вибрато", "belt" to "Белтинг", "tw" to "Твенг", "grit" to "Расщепление", "mel" to "Мелизматика", "sub" to "Субтон", "game" to "Попади в ноту", "vib2" to "Вибрато II", "fal2" to "Фальцет II", "tw2" to "Твенг II", "belt2" to "Белтинг II", "mel2" to "Мелизматика II", "sub2" to "Субтон II"
        )
    }
}
