param(
    [string]$NodePath = "",
    [switch]$ProductionAds,
    [switch]$PlayStore
)

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$jdk = Get-ChildItem -LiteralPath (Join-Path $workspace '.toolchains\jdk21') -Directory | Select-Object -First 1
$sdk = Join-Path $workspace '.toolchains\android-sdk'
$keystore = Join-Path $workspace '.signing\duobiblia-release.jks'
$secretFile = Join-Path $workspace '.signing\keystore-password.dpapi'
$machineSecretFile = Join-Path $workspace '.signing\keystore-password.machine.dpapi'

if (-not $jdk) { throw 'No se encontró el JDK portátil.' }
if (-not (Test-Path -LiteralPath (Join-Path $sdk 'platforms\android-36'))) { throw 'No se encontró Android SDK 36.' }
if (-not (Test-Path -LiteralPath $keystore) -or (-not (Test-Path -LiteralPath $secretFile) -and -not (Test-Path -LiteralPath $machineSecretFile))) { throw 'Ejecuta primero scripts/initialize-android-signing.ps1.' }
if (-not $NodePath) {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { throw 'Indica -NodePath con la ruta de node.exe.' }
    $NodePath = $node.Source
}

if (Test-Path -LiteralPath $machineSecretFile) {
    Add-Type -AssemblyName System.Security
    $protectedBytes = [IO.File]::ReadAllBytes($machineSecretFile)
    $passwordBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
        $protectedBytes,
        $null,
        [System.Security.Cryptography.DataProtectionScope]::LocalMachine
    )
    $plainPassword = [Text.Encoding]::UTF8.GetString($passwordBytes)
} else {
    $securePassword = ConvertTo-SecureString ([IO.File]::ReadAllText($secretFile))
    $credential = [Management.Automation.PSCredential]::new('duobiblia', $securePassword)
    $plainPassword = $credential.GetNetworkCredential().Password
}
$env:JAVA_HOME = $jdk.FullName
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:GRADLE_USER_HOME = Join-Path $workspace '.toolchains\gradle-home'
$env:DUOBIBLIA_KEYSTORE = $keystore
$env:DUOBIBLIA_KEYSTORE_PASSWORD = $plainPassword
$env:DUOBIBLIA_KEY_ALIAS = 'duobiblia'
$env:DUOBIBLIA_KEY_PASSWORD = $plainPassword
$env:DUOBIBLIA_PRODUCTION_ADS = $ProductionAds.IsPresent.ToString().ToLowerInvariant()
$env:VITE_ADMOB_PRODUCTION = $env:DUOBIBLIA_PRODUCTION_ADS
$previousExternalBilling = $env:VITE_EXTERNAL_BILLING_ENABLED
$env:VITE_EXTERNAL_BILLING_ENABLED = if ($PlayStore.IsPresent) { 'false' } else { 'true' }

try {
    & $NodePath (Join-Path $workspace 'node_modules\vite\bin\vite.js') build
    if ($LASTEXITCODE -ne 0) { throw 'La compilación web falló.' }
    & $NodePath (Join-Path $workspace 'node_modules\@capacitor\cli\bin\capacitor') sync android
    if ($LASTEXITCODE -ne 0) { throw 'La sincronización Android falló.' }

    Push-Location (Join-Path $workspace 'android')
    try {
        & '.\gradlew.bat' assembleRelease --no-daemon
        if ($LASTEXITCODE -ne 0) { throw 'La compilación Android falló.' }
        & '.\gradlew.bat' bundleRelease --no-daemon
        if ($LASTEXITCODE -ne 0) { throw 'La compilación del Android App Bundle falló.' }
    } finally {
        Pop-Location
    }

    $version = (Get-Content -LiteralPath (Join-Path $workspace 'package.json') -Raw | ConvertFrom-Json).version
    $distributionSuffix = if ($PlayStore.IsPresent) { '-play' } else { '' }
    $releaseDirectory = Join-Path $workspace 'releases'
    New-Item -ItemType Directory -Force -Path $releaseDirectory | Out-Null
    $sourceApk = Join-Path $workspace 'android\app\build\outputs\apk\release\app-release.apk'
    $destinationApk = Join-Path $releaseDirectory "DuoBiblia-$version$distributionSuffix.apk"
    Copy-Item -LiteralPath $sourceApk -Destination $destinationApk -Force
    $sourceBundle = Join-Path $workspace 'android\app\build\outputs\bundle\release\app-release.aab'
    $destinationBundle = Join-Path $releaseDirectory "DuoBiblia-$version$distributionSuffix.aab"
    Copy-Item -LiteralPath $sourceBundle -Destination $destinationBundle -Force

    $apksigner = Join-Path $sdk 'build-tools\36.0.0\apksigner.bat'
    & $apksigner verify --print-certs $destinationApk
    if ($LASTEXITCODE -ne 0) { throw 'La verificación de la firma falló.' }
    Write-Host "APK listo: $destinationApk"
    Write-Host "AAB listo para Google Play: $destinationBundle"
} finally {
    if ($passwordBytes) { [Array]::Clear($passwordBytes, 0, $passwordBytes.Length) }
    if ($protectedBytes) { [Array]::Clear($protectedBytes, 0, $protectedBytes.Length) }
    $plainPassword = $null
    $env:DUOBIBLIA_KEYSTORE_PASSWORD = $null
    $env:DUOBIBLIA_KEY_PASSWORD = $null
    $env:VITE_EXTERNAL_BILLING_ENABLED = $previousExternalBilling
}
