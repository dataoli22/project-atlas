import Capacitor
import Foundation
import HealthKit

/**
 * Bridges iOS's HealthKit (`HKHealthStore`) to the JS interface declared in
 * mobile/src/healthkit-plugin.ts. Mirrors HealthConnectPlugin.kt's shape (Android) exactly -
 * same method names, same JS result keys - so desktop-api.ts's SyncPayload and the sync screen
 * work unmodified regardless of platform. Atlas's companion app never runs its own backend -
 * this plugin only reads local HealthKit records and hands them to desktop-api.ts, which syncs
 * them to the paired desktop over the LAN.
 *
 * Written against Apple's documented HealthKit API; requires a physical iPhone to build-verify
 * and test (most HealthKit sample types are unavailable in the iOS Simulator) and a Mac + Xcode
 * to compile at all - neither exists in the environment this was authored in. Before relying on
 * it: add the HealthKit capability in Xcode (Signing & Capabilities -> + Capability ->
 * HealthKit), confirm NSHealthShareUsageDescription is set in Info.plist (already added), add
 * this file to the Xcode project (File -> Add Files to "App", not by hand-editing
 * project.pbxproj - Xcode needs to register it in the build phases correctly), then build to a
 * real device and test permission grant/deny. No separate Objective-C bridge (.m) file is
 * needed - conforming to CAPBridgedPlugin directly in Swift (as this class does) is Capacitor
 * 3+'s supported pure-Swift plugin registration path.
 */
@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readRecentSessions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readHydrationMl", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readBodyWeightKg", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readStepCount", returnType: CAPPluginReturnPromise)
    ]

    private let healthStore = HKHealthStore()

    private var readTypes: Set<HKObjectType> {
        var types: Set<HKObjectType> = [HKObjectType.workoutType()]
        if let hydration = HKObjectType.quantityType(forIdentifier: .dietaryWater) {
            types.insert(hydration)
        }
        if let weight = HKObjectType.quantityType(forIdentifier: .bodyMass) {
            types.insert(weight)
        }
        if let steps = HKObjectType.quantityType(forIdentifier: .stepCount) {
            types.insert(steps)
        }
        return types
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestPermissions(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }

        healthStore.requestAuthorization(toShare: nil, read: readTypes) { granted, error in
            if let error = error {
                call.reject("Failed to request HealthKit permissions: \(error.localizedDescription)", nil, error)
                return
            }
            // HealthKit deliberately never reveals whether the user actually granted or denied
            // each read permission (a privacy design choice) - `granted` here only means the
            // authorization *sheet* completed without error, not that data will actually come
            // back. Real availability can only be confirmed by attempting a read and checking
            // whether it returns samples, which the read* methods below do honestly (returning
            // null rather than pretending success).
            call.resolve(["granted": granted])
        }
    }

    @objc func readRecentSessions(_ call: CAPPluginCall) {
        guard let since = parseSinceOrReject(call) else { return }

        let predicate = HKQuery.predicateForSamples(withStart: since, end: Date(), options: .strictStartDate)
        let query = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { [weak self] _, samples, error in
            guard let self = self else { return }
            if let error = error {
                CAPLog.print("HealthKitPlugin readRecentSessions failed: \(error.localizedDescription)")
                call.reject("Failed to read HealthKit workouts: \(error.localizedDescription)", nil, error)
                return
            }
            let workouts = (samples as? [HKWorkout]) ?? []
            let sessions = workouts.map { workout -> [String: Any] in
                [
                    "session_label": workout.workoutActivityType.atlasLabel,
                    "session_type": workout.workoutActivityType.atlasLabel,
                    "duration_minutes": Int(workout.duration / 60),
                    "start_date": ISO8601DateFormatter().string(from: workout.startDate),
                    "source": "healthkit-sdk"
                ]
            }
            call.resolve(["sessions": sessions])
        }
        healthStore.execute(query)
    }

    @objc func readHydrationMl(_ call: CAPPluginCall) {
        guard let since = parseSinceOrReject(call) else { return }
        guard let hydrationType = HKObjectType.quantityType(forIdentifier: .dietaryWater) else {
            call.reject("Dietary water is not a supported HealthKit type on this device.")
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: since, end: Date(), options: .strictStartDate)
        let query = HKStatisticsQuery(quantityType: hydrationType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, statistics, error in
            if let error = error {
                call.reject("Failed to read HealthKit hydration: \(error.localizedDescription)", nil, error)
                return
            }
            guard let sum = statistics?.sumQuantity() else {
                call.resolve(["hydrationMl": NSNull()])
                return
            }
            call.resolve(["hydrationMl": sum.doubleValue(for: .literUnit(with: .milli))])
        }
        healthStore.execute(query)
    }

    @objc func readBodyWeightKg(_ call: CAPPluginCall) {
        guard let weightType = HKObjectType.quantityType(forIdentifier: .bodyMass) else {
            call.reject("Body mass is not a supported HealthKit type on this device.")
            return
        }

        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(sampleType: weightType, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, error in
            if let error = error {
                call.reject("Failed to read HealthKit body weight: \(error.localizedDescription)", nil, error)
                return
            }
            guard let sample = samples?.first as? HKQuantitySample else {
                call.resolve(["bodyWeightKg": NSNull()])
                return
            }
            call.resolve(["bodyWeightKg": sample.quantity.doubleValue(for: .gramUnit(with: .kilo))])
        }
        healthStore.execute(query)
    }

    @objc func readStepCount(_ call: CAPPluginCall) {
        guard let since = parseSinceOrReject(call) else { return }
        guard let stepsType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
            call.reject("Step count is not a supported HealthKit type on this device.")
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: since, end: Date(), options: .strictStartDate)
        let query = HKStatisticsQuery(quantityType: stepsType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, statistics, error in
            if let error = error {
                call.reject("Failed to read HealthKit step count: \(error.localizedDescription)", nil, error)
                return
            }
            guard let sum = statistics?.sumQuantity() else {
                call.resolve(["stepCount": NSNull()])
                return
            }
            call.resolve(["stepCount": Int(sum.doubleValue(for: .count()))])
        }
        healthStore.execute(query)
    }

    private func parseSinceOrReject(_ call: CAPPluginCall) -> Date? {
        guard let sinceIso = call.getString("sinceIso"), !sinceIso.isEmpty else {
            call.reject("Missing required 'sinceIso' option.")
            return nil
        }
        guard let date = ISO8601DateFormatter().date(from: sinceIso) else {
            call.reject("'sinceIso' must be an ISO-8601 timestamp.")
            return nil
        }
        return date
    }
}

private extension HKWorkoutActivityType {
    /// HealthKit has no built-in human-readable name for a workout type - this covers the common
    /// cases the same way HealthConnectPlugin.kt uses Android's ExerciseSessionRecord.exerciseType
    /// enum name, falling back to "Workout" rather than fabricating a specific label for types
    /// not explicitly mapped.
    var atlasLabel: String {
        switch self {
        case .running: return "Run"
        case .walking: return "Walk"
        case .cycling: return "Cycling"
        case .swimming: return "Swimming"
        case .hiking: return "Hiking"
        case .yoga: return "Yoga"
        case .functionalStrengthTraining, .traditionalStrengthTraining: return "Strength"
        case .coreTraining: return "Core"
        case .elliptical: return "Elliptical"
        case .rowing: return "Rowing"
        default: return "Workout"
        }
    }
}
