$root = 'C:\Users\Abdullo\OneDrive\Desktop\G.E.M tournament'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:5500/')
$listener.Start()
Write-Host 'Server running at http://localhost:5500' -ForegroundColor Green

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $local = $req.Url.LocalPath

    if ($local -eq '/' -or $local -eq '/index.html') {
        $file = Join-Path $root 'index.html'
    } else {
        $file = Join-Path $root $local.TrimStart('/')
    }

    if (Test-Path $file) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $res.ContentType = 'text/html; charset=utf-8'
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes('Not found')
        $res.ContentLength64 = $msg.Length
        $res.OutputStream.Write($msg, 0, $msg.Length)
    }
    $res.Close()
}
