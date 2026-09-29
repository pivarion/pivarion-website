"""Loopback-only capture receiver and range-capable prototype server."""
import http.server, pathlib, re, argparse
p=argparse.ArgumentParser();p.add_argument('--capture',action='store_true');p.add_argument('--port',type=int,default=8773);a=p.parse_args()
root=pathlib.Path('/tmp/pivarion-mobile-capture') if a.capture else pathlib.Path.cwd()
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(root),**kwargs)
    def do_POST(self):
        match=re.fullmatch(r'/frames/(opening|wheel)/(\d{4}\.png)',self.path)
        if not a.capture or not match:self.send_error(404);return
        size=int(self.headers.get('Content-Length','0'))
        if size<=0 or size>10_000_000:self.send_error(413);return
        target=root/'frames'/match[1]/match[2];target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(self.rfile.read(size));self.send_response(204);self.end_headers()
    def send_head(self):
        file=pathlib.Path(self.translate_path(self.path))
        byte_range=self.headers.get('Range','')
        if file.is_file() and byte_range:
            m=re.fullmatch(r'bytes=(\d+)-(\d*)',byte_range)
            if not m:self.send_error(416);return None
            size=file.stat().st_size;start=int(m[1]);end=min(int(m[2]) if m[2] else size-1,size-1)
            if start>end:self.send_error(416);return None
            self.send_response(206);self.send_header('Content-Type',self.guess_type(str(file)))
            self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Content-Length',str(end-start+1));self.send_header('Accept-Ranges','bytes');self.end_headers()
            with file.open('rb') as f:
                f.seek(start);self.wfile.write(f.read(end-start+1))
            return None
        return super().send_head()
    def log_message(self,*args):pass
http.server.ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
