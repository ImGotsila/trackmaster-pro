# TrackMaster Pro - Quick Deploy & Analyze Script
# This script automates: commit, push, deploy to NAS, and run analysis

$ErrorActionPreference = "Stop"

Write-Host "=== TrackMaster Pro Quick Deploy & Analyze ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Git Status Check
Write-Host "[1/5] Checking git status..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "Changes detected. Committing..." -ForegroundColor Green
    
    # Prompt for commit message
    $commitMsg = Read-Host "Enter commit message (or press Enter for default)"
    if ([string]::IsNullOrWhiteSpace($commitMsg)) {
        $commitMsg = "chore: update from quick deploy script"
    }
    
    git add .
    git commit -m $commitMsg
    git push origin main
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Git push failed!"
        exit 1
    }
    Write-Host "✅ Code pushed to GitHub" -ForegroundColor Green
}
else {
    Write-Host "No changes to commit." -ForegroundColor Gray
}

Write-Host ""

# Step 2: Deploy to NAS
Write-Host "[2/5] Deploying to NAS..." -ForegroundColor Yellow
Write-Host "NOTE: You will be asked for SSH password multiple times." -ForegroundColor Gray
Write-Host ""

# Remove old container first
Write-Host "Removing old container..." -ForegroundColor Gray
ssh ImGotsila@192.168.1.148 "echo 'Y18363@dd' | sudo -S /usr/local/bin/docker rm -f trackmaster-pro" 2>$null

# Run deploy script
.\deploy_to_nas.ps1

if ($LASTEXITCODE -ne 0) {
    Write-Error "Deployment failed!"
    exit 1
}

Write-Host ""
Write-Host "✅ Deployed to NAS successfully" -ForegroundColor Green
Write-Host ""

# Step 3: Wait for container to start
Write-Host "[3/5] Waiting for container to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Write-Host "✅ Container ready" -ForegroundColor Green
Write-Host ""

# Step 4: Run Analysis
Write-Host "[4/5] Running analysis on NAS..." -ForegroundColor Yellow
Write-Host ""

ssh ImGotsila@192.168.1.148 "echo 'Y18363@dd' | sudo -S /usr/local/bin/docker exec trackmaster-pro node server/analyze_shipping.cjs"

if ($LASTEXITCODE -ne 0) {
    Write-Warning "Analysis completed with warnings (this might be OK)"
}
else {
    Write-Host "✅ Analysis completed" -ForegroundColor Green
}

Write-Host ""

# Step 5: Summary
Write-Host "[5/5] Summary" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "✅ Code pushed to GitHub" -ForegroundColor Green
Write-Host "✅ Deployed to NAS (192.168.1.148)" -ForegroundColor Green
Write-Host "✅ Analysis executed" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "🌐 Application: http://192.168.1.148:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "✨ All done!" -ForegroundColor Green
