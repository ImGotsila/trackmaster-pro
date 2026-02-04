$User = "ImGotsila"
$HostIP = "192.168.1.148"
$RemotePath = "/volume1/trackmaster-pro-v2/trackmaster-pro"
$SudoPass = "Y18363@dd"

Write-Host "=== TrackMaster Pro NAS Deployment ==="
Write-Host "Target: ${User}@${HostIP}:${RemotePath}"
Write-Host "NOTE: You will be asked for your SSH password multiple times."
Write-Host ""

# 1. Create Archive
Write-Host "[1/4] Creating backup archive (deploy_package.tar.gz)..."
try {
    tar --exclude node_modules --exclude server/node_modules --exclude .git --exclude dist --exclude deploy_package.tar.gz --exclude project.tar.gz -czf deploy_package.tar.gz .
    if ($LASTEXITCODE -ne 0) { throw "Tar failed" }
    Write-Host "Archive created successfully."
}
catch {
    Write-Error "Failed to create archive. Ensure 'tar' is installed."
    exit 1
}

# 2. Create Directory
Write-Host "[2/4] Ensuring remote directory exists..."
Write-Host "input password for Step 2 (mkdir & chown):"
# Using sudo to create directory and then chown it to the connecting user
# We also create the 'data' subdirectory required by the docker-compose volume
ssh ${User}@${HostIP} "echo '${SudoPass}' | sudo -S mkdir -p ${RemotePath}/data && echo '${SudoPass}' | sudo -S rm -f ${RemotePath}/project.tar.gz && echo '${SudoPass}' | sudo -S chmod -R 777 ${RemotePath}"
if ($LASTEXITCODE -ne 0) { 
    Write-Error "Failed to create directory or set permissions. Check password."
    exit 1 
}

# 3. Copy Files
Write-Host "[3/4] Uploading archive to NAS..."
Write-Host "input password for Step 3 (upload):"
# Using cmd type piped to ssh cat to avoid SCP protocol failure causes by Synology specific Shell Banners
# The "Warning: Data should only be stored..." message on your NAS breaks standard SCP.
# Using cmd to handle the ENTIRE pipe ensures binary data isn't corrupted by PowerShell's string handling.
# We construct the command string carefully to handle quotes.
Write-Host "Running binary upload via CMD to bypass PowerShell encoding..."
$UploadCmd = "type deploy_package.tar.gz | ssh ${User}@${HostIP} ""cat > ${RemotePath}/project.tar.gz"""
Write-Host "Running Pipe upload..."
cmd /c $UploadCmd
if ($LASTEXITCODE -ne 0) { 
    Write-Error "Failed to upload file. Check password."
    exit 1 
}
Write-Host "File uploaded successfully."
if ($LASTEXITCODE -ne 0) { 
    Write-Error "Failed to upload file. Check password."
    exit 1 
}

# 4. Deploy
Write-Host "[4/4] Extracting and starting Docker container..."
Write-Host "input password for Step 4 (deploy):"
# We send the sudo password via echo to avoid the interactive prompt requirement
# We use the absolute path /usr/local/bin/docker-compose because it's not in the sudo secure_path on Synology
# We also FORCE remove the old container just in case it was created without compose (orphaned)
# NOTE: We must also use the absolute path for 'docker' itself: /usr/local/bin/docker
ssh ${User}@${HostIP} "cd ${RemotePath} && tar -xzf project.tar.gz && echo '${SudoPass}' | sudo -S /usr/local/bin/docker rm -f trackmaster-pro || true && echo '${SudoPass}' | sudo -S /usr/local/bin/docker build --no-cache -t trackmaster-pro . && echo '${SudoPass}' | sudo -S /usr/local/bin/docker run -d --name trackmaster-pro -p 3000:3000 --restart unless-stopped -v ${RemotePath}/data:/app/data trackmaster-pro"
if ($LASTEXITCODE -ne 0) { 
    Write-Error "Failed to deploy. Check logs above."
    exit 1 
}

# Cleanup
Remove-Item deploy_package.tar.gz -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Deployment script finished success!"
Write-Host "Verify the application at: http://${HostIP}:3000"
