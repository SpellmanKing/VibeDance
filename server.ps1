# ==========================================================
# VibeDance - Servidor Web Estático Local (PowerShell)
# ==========================================================

$port = 5500
$frontendPath = Join-Path $PSScriptRoot "frontend"

$mimeMap = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".woff2"= "font/woff2"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
} catch {
    # Tenta porta alternativa caso 5500 esteja ocupada
    $port = 8081
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Start()
}

$serverUrl = "http://localhost:$port/"
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " [VibeDance Web Server Ativo]" -ForegroundColor Magenta
Write-Host " Acesse em seu navegador: $serverUrl" -ForegroundColor Green
Write-Host " Servindo a pasta: $frontendPath" -ForegroundColor DarkGray
Write-Host " Pressione Ctrl+C no terminal para encerrar o servidor" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan

# Abre automaticamente o navegador padrão do usuário
Start-Process $serverUrl

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $relPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($relPath)) {
            $relPath = "index.html"
        }

        # Converte URL path para o separador de diretório do Windows
        $relPath = $relPath -replace '/', '\'
        $filePath = Join-Path $frontendPath $relPath

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { "application/octet-stream" }
            
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $relPath")
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }
        $response.Close()
    } catch {
        # Continua escutando
    }
}
