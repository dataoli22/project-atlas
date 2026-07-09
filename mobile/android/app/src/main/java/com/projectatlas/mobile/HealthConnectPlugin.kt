package com.projectatlas.mobile

import android.util.Log
import androidx.activity.result.contract.ActivityResultContract
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant

/**
 * Bridges Android's Health Connect SDK (androidx.health.connect) to the JS interface declared
 * in mobile/src/health-connect-plugin.ts. Atlas's companion app never runs its own backend -
 * this plugin only reads local Health Connect records and hands them to desktop-api.ts, which
 * syncs them to the paired desktop over the LAN. See docs/mobile-architecture.md.
 *
 * Cannot be built or exercised in this environment (no Android SDK/emulator/device); written
 * against the documented Health Connect client API and verified only by inspection. Build and
 * runtime-test this in Android Studio before relying on it - in particular permission grant,
 * denial, and partial-grant flows, and Health Connect app availability across OEM builds.
 */
@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val requiredPermissions = setOf(
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(HydrationRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
    )

    private val healthConnectClient: HealthConnectClient? by lazy {
        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
            HealthConnectClient.getOrCreate(context)
        } else {
            null
        }
    }

    private var pendingPermissionCall: PluginCall? = null

    private val permissionContract: ActivityResultContract<Set<String>, Set<String>> =
        PermissionController.createRequestPermissionResultContract()

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val status = HealthConnectClient.getSdkStatus(context)
        val result = JSObject()
        result.put("available", status == HealthConnectClient.SDK_AVAILABLE)
        call.resolve(result)
    }

    @PluginMethod
    fun requestPermissions(call: PluginCall) {
        val client = healthConnectClient
        if (client == null) {
            val result = JSObject()
            result.put("granted", false)
            call.resolve(result)
            return
        }

        CoroutineScope(Dispatchers.Main).launch {
            val alreadyGranted = client.permissionController.getGrantedPermissions()
            if (alreadyGranted.containsAll(requiredPermissions)) {
                val result = JSObject()
                result.put("granted", true)
                call.resolve(result)
                return@launch
            }

            pendingPermissionCall = call
            val launcher = activity.activityResultRegistry.register(
                "atlas-health-connect-permissions",
                permissionContract,
            ) { granted ->
                val pending = pendingPermissionCall
                pendingPermissionCall = null
                val result = JSObject()
                result.put("granted", granted.containsAll(requiredPermissions))
                pending?.resolve(result)
            }
            launcher.launch(requiredPermissions)
        }
    }

    @PluginMethod
    fun readRecentSessions(call: PluginCall) {
        val client = healthConnectClient ?: return call.reject("Health Connect is not available on this device.")
        val since = parseSinceOrReject(call) ?: return

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val response = client.readRecords(
                    ReadRecordsRequest(
                        recordType = ExerciseSessionRecord::class,
                        timeRangeFilter = TimeRangeFilter.after(since),
                    )
                )
                val sessions = JSArray()
                for (record in response.records) {
                    val session = JSObject()
                    session.put("session_label", record.title ?: record.exerciseType.toString())
                    session.put("session_type", record.exerciseType.toString())
                    val minutes = Duration.between(record.startTime, record.endTime).toMinutes()
                    session.put("duration_minutes", minutes)
                    session.put("start_date", record.startTime.toString())
                    session.put("source", "health-connect-sdk")
                    sessions.put(session)
                }
                val result = JSObject()
                result.put("sessions", sessions)
                call.resolve(result)
            } catch (error: Exception) {
                Log.e("HealthConnectPlugin", "readRecentSessions failed", error)
                call.reject("Failed to read Health Connect sessions: ${error.message}", error)
            }
        }
    }

    @PluginMethod
    fun readHydrationMl(call: PluginCall) {
        val client = healthConnectClient ?: return call.reject("Health Connect is not available on this device.")
        val since = parseSinceOrReject(call) ?: return

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val response = client.readRecords(
                    ReadRecordsRequest(
                        recordType = HydrationRecord::class,
                        timeRangeFilter = TimeRangeFilter.after(since),
                    )
                )
                val totalMilliliters = response.records.sumOf { it.volume.inMilliliters }
                val result = JSObject()
                if (response.records.isEmpty()) {
                    result.put("hydrationMl", JSObject.NULL)
                } else {
                    result.put("hydrationMl", totalMilliliters)
                }
                call.resolve(result)
            } catch (error: Exception) {
                Log.e("HealthConnectPlugin", "readHydrationMl failed", error)
                call.reject("Failed to read Health Connect hydration: ${error.message}", error)
            }
        }
    }

    @PluginMethod
    fun readBodyWeightKg(call: PluginCall) {
        val client = healthConnectClient ?: return call.reject("Health Connect is not available on this device.")

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val response = client.readRecords(
                    ReadRecordsRequest(
                        recordType = WeightRecord::class,
                        timeRangeFilter = TimeRangeFilter.before(Instant.now()),
                    )
                )
                val latest = response.records.maxByOrNull { it.time }
                val result = JSObject()
                if (latest == null) {
                    result.put("bodyWeightKg", JSObject.NULL)
                } else {
                    result.put("bodyWeightKg", latest.weight.inKilograms)
                }
                call.resolve(result)
            } catch (error: Exception) {
                Log.e("HealthConnectPlugin", "readBodyWeightKg failed", error)
                call.reject("Failed to read Health Connect body weight: ${error.message}", error)
            }
        }
    }

    @PluginMethod
    fun readStepCount(call: PluginCall) {
        val client = healthConnectClient ?: return call.reject("Health Connect is not available on this device.")
        val since = parseSinceOrReject(call) ?: return

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val response = client.readRecords(
                    ReadRecordsRequest(
                        recordType = StepsRecord::class,
                        timeRangeFilter = TimeRangeFilter.after(since),
                    )
                )
                val total = response.records.sumOf { it.count }
                val result = JSObject()
                if (response.records.isEmpty()) {
                    result.put("stepCount", JSObject.NULL)
                } else {
                    result.put("stepCount", total)
                }
                call.resolve(result)
            } catch (error: Exception) {
                Log.e("HealthConnectPlugin", "readStepCount failed", error)
                call.reject("Failed to read Health Connect step count: ${error.message}", error)
            }
        }
    }

    private fun parseSinceOrReject(call: PluginCall): Instant? {
        val sinceIso = call.getString("sinceIso")
        if (sinceIso.isNullOrBlank()) {
            call.reject("Missing required 'sinceIso' option.")
            return null
        }
        return try {
            Instant.parse(sinceIso)
        } catch (error: Exception) {
            call.reject("'sinceIso' must be an ISO-8601 timestamp: ${error.message}", error)
            null
        }
    }
}
