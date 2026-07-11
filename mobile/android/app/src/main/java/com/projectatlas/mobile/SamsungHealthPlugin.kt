package com.projectatlas.mobile

import android.content.pm.PackageManager
import android.util.Log
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.samsung.android.sdk.health.data.HealthDataService
import com.samsung.android.sdk.health.data.HealthDataStore
import com.samsung.android.sdk.health.data.permission.AccessType
import com.samsung.android.sdk.health.data.request.DataType
import com.samsung.android.sdk.health.data.permission.Permission
import com.samsung.android.sdk.health.data.request.DataTypes
import com.samsung.android.sdk.health.data.request.InstantTimeFilter
import com.samsung.android.sdk.health.data.request.LocalDateFilter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate

/**
 * Bridges Samsung's Health Data SDK (com.samsung.android.sdk.health.data, v1.1.0) to the JS
 * interface declared in mobile/src/samsung-health-plugin.ts. Written against the real SDK
 * (decompiled from the .aar's classes.jar to confirm exact method/field signatures, since the
 * SDK's own bundled docs are just redirect stubs to Samsung's live developer site) after partner
 * program approval was obtained - see mobile/android/app/build.gradle for the dependency note.
 *
 * Cannot be exercised on-device in this environment: the Samsung Health SDK only authenticates
 * when the real Samsung Health app is installed, and that app is Samsung-device-exclusive
 * (distributed via Galaxy Store, not Google Play) - it cannot be installed on a generic AOSP
 * emulator. Build/compile-verified only; runtime permission grant/deny flows and actual data
 * shape need a real Samsung device.
 *
 * Data type coverage in this SDK version: SLEEP, HEART_RATE, and ENERGY_SCORE are read (map to
 * sleep_hours/resting_hr/energy_score on SamsungHealthDeviceSyncRequest). There is no dedicated
 * "resting heart rate" or "stress" data type exposed by DataTypes in v1.1.0 - resting_hr is
 * approximated as the minimum heart rate reading over the query window (HeartRateType.MIN_HEART_RATE,
 * a real field the SDK aggregates itself, not a guess computed client-side), and readStressLevel
 * always resolves null rather than fabricating a value the SDK doesn't provide. recent_sessions
 * stays empty - Samsung's own exercise session data type isn't exposed for read access in this
 * SDK version; Health Connect's ExerciseSessionRecord already covers that ground for devices
 * where Samsung Health writes into the shared Health Connect store.
 */
@CapacitorPlugin(name = "SamsungHealth")
class SamsungHealthPlugin : Plugin() {

    private val requiredPermissions = setOf(
        Permission.of(DataTypes.SLEEP, AccessType.READ),
        Permission.of(DataTypes.HEART_RATE, AccessType.READ),
        Permission.of(DataTypes.ENERGY_SCORE, AccessType.READ),
    )

    private val healthDataStore: HealthDataStore by lazy {
        HealthDataService.getStore(context)
    }

    private fun isSamsungHealthAppInstalled(): Boolean {
        return try {
            context.packageManager.getPackageInfo("com.sec.android.app.shealth", 0)
            true
        } catch (error: PackageManager.NameNotFoundException) {
            false
        }
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        // The SDK has no cheap standalone "is available" call - app presence is the real
        // precondition (its own AAR manifest queries for this package), so check that directly
        // rather than assuming success and failing later.
        val result = JSObject()
        result.put("available", isSamsungHealthAppInstalled())
        call.resolve(result)
    }

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        if (!isSamsungHealthAppInstalled()) {
            val result = JSObject()
            result.put("granted", false)
            call.resolve(result)
            return
        }

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val alreadyGranted = healthDataStore.getGrantedPermissions(requiredPermissions)
                if (alreadyGranted.containsAll(requiredPermissions)) {
                    val result = JSObject()
                    result.put("granted", true)
                    call.resolve(result)
                    return@launch
                }

                val granted = healthDataStore.requestPermissions(requiredPermissions, activity)
                val result = JSObject()
                result.put("granted", granted.containsAll(requiredPermissions))
                call.resolve(result)
            } catch (error: Exception) {
                Log.e("SamsungHealthPlugin", "requestPermissions failed", error)
                call.reject("Failed to request Samsung Health permissions: ${error.message}", error)
            }
        }
    }

    @PluginMethod
    fun readRecentSessions(call: PluginCall) {
        // See class doc: Samsung's exercise session data type isn't exposed for read access in
        // this SDK version, so this always returns empty rather than fabricating sessions.
        val result = JSObject()
        result.put("sessions", JSArray())
        call.resolve(result)
    }

    @PluginMethod
    fun readSleepHours(call: PluginCall) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val request = DataTypes.SLEEP.readDataRequestBuilder
                    .setInstantTimeFilter(InstantTimeFilter.since(Instant.now().minusSeconds(60 * 60 * 32)))
                    .build()
                val response = healthDataStore.readData(request)
                val totalSeconds = response.dataList
                    .flatMap { it.getValueOrDefault(DataType.SleepType.SESSIONS, emptyList()) }
                    .sumOf { it.duration.seconds }

                val result = JSObject()
                if (totalSeconds <= 0) {
                    result.put("sleepHours", JSObject.NULL)
                } else {
                    result.put("sleepHours", totalSeconds / 3600.0)
                }
                call.resolve(result)
            } catch (error: Exception) {
                Log.e("SamsungHealthPlugin", "readSleepHours failed", error)
                call.reject("Failed to read Samsung Health sleep data: ${error.message}", error)
            }
        }
    }

    @PluginMethod
    fun readRestingHeartRate(call: PluginCall) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val request = DataTypes.HEART_RATE.readDataRequestBuilder
                    .setInstantTimeFilter(InstantTimeFilter.since(Instant.now().minusSeconds(60 * 60 * 24)))
                    .build()
                val response = healthDataStore.readData(request)
                // Approximation, not a dedicated resting-HR metric: the SDK doesn't expose one
                // directly in this version, so the lowest MIN_HEART_RATE reading across the
                // window (a real field the SDK itself aggregates, not client-computed) stands in
                // for it - see class doc.
                val minHeartRate = response.dataList
                    .mapNotNull { it.getValue(DataType.HeartRateType.MIN_HEART_RATE) }
                    .minOrNull()

                val result = JSObject()
                result.put("restingHr", minHeartRate?.toInt() ?: JSObject.NULL)
                call.resolve(result)
            } catch (error: Exception) {
                Log.e("SamsungHealthPlugin", "readRestingHeartRate failed", error)
                call.reject("Failed to read Samsung Health heart rate data: ${error.message}", error)
            }
        }
    }

    @PluginMethod
    fun readEnergyScore(call: PluginCall) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val request = DataTypes.ENERGY_SCORE.readDataRequestBuilder
                    .setLocalDateFilter(LocalDateFilter.since(LocalDate.now().minusDays(1)))
                    .build()
                val response = healthDataStore.readData(request)
                val latestScore = response.dataList
                    .sortedByDescending { it.startTime }
                    .firstNotNullOfOrNull { it.getValue(DataType.EnergyScoreType.ENERGY_SCORE) }

                val result = JSObject()
                result.put("energyScore", latestScore?.toInt() ?: JSObject.NULL)
                call.resolve(result)
            } catch (error: Exception) {
                Log.e("SamsungHealthPlugin", "readEnergyScore failed", error)
                call.reject("Failed to read Samsung Health energy score: ${error.message}", error)
            }
        }
    }

    @PluginMethod
    fun readStressLevel(call: PluginCall) {
        // No stress data type is exposed by DataTypes in SDK v1.1.0 - resolve null rather than
        // fabricate a value. See class doc.
        val result = JSObject()
        result.put("stressLevel", JSObject.NULL)
        call.resolve(result)
    }
}
