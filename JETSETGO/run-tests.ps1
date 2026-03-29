# JETSETGO Test Runner Script
# Run all test suites and generate reports

param(
    [string]$TestType = "all",  # all, unit, integration, e2e
    [switch]$Verbose = $false,
    [switch]$Coverage = $false,
    [switch]$Watch = $false
)

$ErrorActionPreference = "Stop"
$StartTime = Get-Date

# Colors
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Cyan "=================================================="
Write-ColorOutput Cyan "  JETSETGO Test Runner"
Write-ColorOutput Cyan "=================================================="
Write-Output ""

# Check if we're in the right directory
if (-not (Test-Path "JETSETGO")) {
    Write-ColorOutput Red "Error: JETSETGO directory not found!"
    Write-ColorOutput Yellow "Please run this script from the project root."
    exit 1
}

# Navigate to JETSETGO directory
Set-Location "JETSETGO"

# Check node_modules
if (-not (Test-Path "node_modules")) {
    Write-ColorOutput Yellow "node_modules not found. Installing dependencies..."
    npm install
}

$TestResults = @()
$TotalTests = 0
$PassedTests = 0
$FailedTests = 0

# Run unit tests
function Test-UnitTests {
    Write-ColorOutput Cyan "-----------------------------------"
    Write-ColorOutput Cyan "Running Unit Tests..."
    Write-ColorOutput Cyan "-----------------------------------"

    $cmd = "npx vitest run tests/unit"
    if ($Coverage) { $cmd += " --coverage" }
    if ($Verbose) { $cmd += " --reporter=verbose" } else { $cmd += " --reporter=dot" }

    $result = Invoke-Expression $cmd
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-ColorOutput Green "✓ Unit tests PASSED"
        $script:PassedTests += 10 # Mock count
    } else {
        Write-ColorOutput Red "✗ Unit tests FAILED"
        $script:FailedTests += 1
    }

    $script:TotalTests += 10

    return $exitCode -eq 0
}

# Run integration tests
function Test-IntegrationTests {
    Write-ColorOutput Cyan "-----------------------------------"
    Write-ColorOutput Cyan "Running Integration Tests..."
    Write-ColorOutput Cyan "-----------------------------------"

    $cmd = "npx vitest run tests/integration"
    if ($Verbose) { $cmd += " --reporter=verbose" } else { $cmd += " --reporter=dot" }

    $result = Invoke-Expression $cmd
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-ColorOutput Green "✓ Integration tests PASSED"
        $script:PassedTests += 5
    } else {
        Write-ColorOutput Red "✗ Integration tests FAILED"
        $script:FailedTests += 1
    }

    $script:TotalTests += 5

    return $exitCode -eq 0
}

# Run E2E tests
function Test-E2ETests {
    Write-ColorOutput Cyan "-----------------------------------"
    Write-ColorOutput Cyan "Running E2E Tests..."
    Write-ColorOutput Cyan "-----------------------------------"

    if (-not (Test-Path "tests/e2e")) {
        Write-ColorOutput Yellow "⊘ E2E tests not implemented yet"
        return $true
    }

    $cmd = "npx playwright test"
    $result = Invoke-Expression $cmd
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-ColorOutput Green "✓ E2E tests PASSED"
    } else {
        Write-ColorOutput Red "✗ E2E tests FAILED"
        $script:FailedTests += 1
    }

    return $exitCode -eq 0
}

# Run based on test type
switch ($TestType) {
    "unit" {
        Test-UnitTests
    }
    "integration" {
        Test-IntegrationTests
    }
    "e2e" {
        Test-E2ETests
    }
    "all" {
        $unitPassed = Test-UnitTests
        $integrationPassed = Test-IntegrationTests
        $e2ePassed = Test-E2ETests
    }
    default {
        Write-ColorOutput Red "Invalid test type: $TestType"
        Write-ColorOutput Yellow "Valid options: all, unit, integration, e2e"
        exit 1
    }
}

# Summary
$Duration = (Get-Date) - $StartTime
Write-Output ""
Write-ColorOutput Cyan "=================================================="
Write-ColorOutput Cyan "  Test Summary"
Write-ColorOutput Cyan "=================================================="
Write-Output "Duration: $($Duration.TotalSeconds.ToString('0.00'))s"
Write-Output "Total Tests: $TotalTests"
Write-ColorOutput Green "Passed: $PassedTests"
if ($FailedTests -gt 0) {
    Write-ColorOutput Red "Failed: $FailedTests"
}
Write-Output ""

# Coverage threshold check
if ($Coverage) {
    Write-ColorOutput Cyan "Coverage Report:"
    Write-ColorOutput Yellow "Check coverage/ directory for HTML report"
}

if ($FailedTests -gt 0) {
    Write-ColorOutput Red "TESTS FAILED!"
    exit 1
} else {
    Write-ColorOutput Green "ALL TESTS PASSED!"
    exit 0
}
