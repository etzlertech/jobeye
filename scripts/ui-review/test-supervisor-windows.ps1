# PowerShell script to test supervisor page with BrowserCat from Windows
# This bypasses WSL1 networking limitations

Write-Host "🪟 BrowserCat Supervisor Test - Windows PowerShell" -ForegroundColor Cyan
Write-Host ""

# Set working directory
Set-Location "C:\Users\tetzler.KWW\OneDrive - Kaspar Companies\Documents\GitHub\jobeye"
Write-Host "📂 Working directory: $(Get-Location)" -ForegroundColor Green

# Set Node.js environment for better connectivity
$env:NODE_OPTIONS = "--dns-result-order=ipv4first"
Write-Host "🔧 Node options: $env:NODE_OPTIONS" -ForegroundColor Yellow

Write-Host ""
Write-Host "🧪 Testing BrowserCat connection to supervisor page..." -ForegroundColor Cyan

try {
    # Run the BrowserCat test
    npx tsx scripts/ui-review/browsercat-working.ts
    
    Write-Host ""
    Write-Host "✅ Test completed successfully!" -ForegroundColor Green
    
    # Check if screenshot was created
    $screenshotPath = "ui-review-output/browsercat-supervisor/supervisor-page.png"
    if (Test-Path $screenshotPath) {
        Write-Host "📸 Screenshot saved at: $screenshotPath" -ForegroundColor Green
        Write-Host "💡 You can now view the supervisor page screenshot!" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ Test failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Try running this from Command Prompt if PowerShell fails" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")