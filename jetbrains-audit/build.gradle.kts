// Headless highlighting dump for the JetBrains audit.
// Runs the real IDE test framework against our fixtures and dumps, per
// token: text range + TextAttributesKey + its fallback chain. Color
// resolution against our .icls happens outside (scripts/compare-jetbrains-dump.ts).
//
//   ./gradlew test -PideType=GO -PideVersion=2026.1   # GoLand
//   ./gradlew test -PideType=WS -PideVersion=2026.1   # WebStorm
//   ./gradlew test -PideType=IC -PideVersion=2026.1   # IntelliJ IDEA Community (Java)
//   ./gradlew test -PideType=PC -PideVersion=2026.1   # PyCharm Community (Python)
//
// The IDE version lives in .github/workflows/jetbrains-audit.yml (the matrix is
// the single source of truth); the default below only mirrors it for local runs.
import org.jetbrains.intellij.platform.gradle.TestFrameworkType

plugins {
    id("java")
    id("org.jetbrains.intellij.platform") version "2.5.0"
}

repositories {
    mavenCentral()
    intellijPlatform { defaultRepositories() }
}

val ideType = providers.gradleProperty("ideType").getOrElse("GO")
// keep in sync with the workflow matrix (which is authoritative)
val ideVersion = providers.gradleProperty("ideVersion").getOrElse("2026.1")

// language support is a bundled plugin and must be enabled explicitly in tests
val bundled = when (ideType) {
    "GO" -> listOf("org.jetbrains.plugins.go", "com.intellij.modules.json", "com.intellij.platform.images")
    "WS" -> listOf("JavaScript", "com.intellij.css", "com.intellij.modules.json", "com.intellij.platform.images")
    // IDEA ships Java as a bundled plugin; PyCharm ships Python as "PythonCore"
    "IC", "IU" -> listOf("com.intellij.java", "com.intellij.modules.json", "com.intellij.platform.images")
    "PC", "PY" -> listOf("PythonCore", "com.intellij.modules.json", "com.intellij.platform.images")
    else -> listOf("com.intellij.platform.images")
}

dependencies {
    intellijPlatform {
        create(ideType, ideVersion)
        bundledPlugins(bundled)
        testFramework(TestFrameworkType.Platform)
        // Java highlighting tests need the Java test framework artifact on top
        // of the platform one (JavaCodeInsightFixtureTestCase infrastructure).
        if (ideType == "IC" || ideType == "IU") testFramework(TestFrameworkType.Plugin.Java)
    }
    testImplementation("junit:junit:4.13.2")
}

java {
    toolchain { languageVersion = JavaLanguageVersion.of(21) }
}

intellijPlatform {
    instrumentCode = false // not needed for highlighting dumps; unresolvable for non-Java IDEs
    buildSearchableOptions = false
}

tasks.test {
    useJUnit()
    // GOROOT (e.g. the CI toolcache) lies outside the test VFS guard's allowed
    // roots; this is the platform's documented escape hatch for that guard
    systemProperty("NO_FS_ROOTS_ACCESS_CHECK", "true")
    systemProperty("audit.ideType", ideType)
    // absolute paths so the test can find fixtures and write dumps
    systemProperty("audit.fixtures", rootDir.parentFile.resolve("audit/fixtures").absolutePath)
    systemProperty("audit.out", layout.buildDirectory.dir("dumps/$ideType").get().asFile.absolutePath)
    // Go SDK so builtin classification (len/make -> GO_BUILTIN_FUNCTION_CALL) works;
    // pass -Pgoroot=... or export GOROOT
    systemProperty(
        "audit.goroot",
        providers.gradleProperty("goroot").orElse(providers.environmentVariable("GOROOT")).getOrElse("")
    )
}
