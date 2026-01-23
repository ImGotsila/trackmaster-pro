$User = "ImGotsila"
$HostIP = "192.168.1.139"
$RemotePath = "/volume1/docker/npm"
$User = "ImGotsila"
$HostIP = "192.168.1.139"
$RemotePath = "/volume1/docker/npm"
# Prompt for Sudo password to avoid hardcoding errors
$SudoPass = Read-Host -Prompt "Enter your NAS sudo password (for $User)"

Write-Host "=== Nginx Proxy Manager Deployment ==="
Write-Host "Target: ${User}@${HostIP}:${RemotePath}"
Write-Host ""

# 1. Create Directory
Write-Host "[1/3] Ensuring remote directory exists..."
Write-Host "input password for Step 1 (mkdir):"
# Create main folder AND subfolders (data, letsencrypt)
ssh ${User}@${HostIP} "echo '${SudoPass}' | sudo -S mkdir -p ${RemotePath}/data ${RemotePath}/letsencrypt && echo '${SudoPass}' | sudo -S chown -R ${User}:users ${RemotePath}"
if ($LASTEXITCODE -ne 0) { 
    Write-Error "Failed to create directory. Check password."
    exit 1 
}

# 2. Upload Docker Compose
Write-Host "[2/3] Uploading docker-compose.yml..."
Write-Host "input password for Step 2 (upload):"
# Using cmd pipe method which we know works reliably
$UploadCmd = "type npm\docker-compose.yml | ssh ${User}@${HostIP} ""cat > ${RemotePath}/docker-compose.yml"""
cmd /c $UploadCmd
if ($LASTEXITCODE -ne 0) { 
    Write-Error "Failed to upload file."
    exit 1 
}

# 3. Deploy
Write-Host "[3/3] Starting Nginx Proxy Manager..."
Write-Host "input password for Step 3 (deploy):"
# Using absolute paths for docker and docker-compose
ssh ${User}@${HostIP} "cd ${RemotePath} && echo '${SudoPass}' | sudo -S /usr/local/bin/docker-compose down && echo '${SudoPass}' | sudo -S /usr/local/bin/docker-compose up -d"
if ($LASTEXITCODE -ne 0) { 
    Write-Error "Failed to deploy. Check logs."
    exit 1 
}

Write-Host ""
Write-Host "NPM Deployment Success!"
Write-Host "Admin Interface: http://${HostIP}:81"
Write-Host "Default Login:"
Write-Host "  Email:    admin@example.com"
Write-Host "  Password: changeme"
