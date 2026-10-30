#!/usr/bin/env python3
"""Pruebas aisladas. Podman, cron y systemctl se simulan; no hay acceso a la BD real."""
import gzip
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import time
import unittest

PACKAGE = Path(__file__).resolve().parents[1]
SQL = b'-- PostgreSQL database dump\nCREATE TABLE prueba (id integer);\n-- PostgreSQL database dump complete\n'

PODMAN = r'''#!/usr/bin/env python3
import os,sys,time
from pathlib import Path
root=Path(os.environ['QA_ROOT'])
args=sys.argv[1:]
with (root/'podman_calls').open('a') as f: f.write(' '.join(args)+'\n')
if 'pg_isready' in args:
    p=root/'ready_count'
    count=int(p.read_text())+1 if p.exists() else 1
    p.write_text(str(count))
    sys.exit(1 if os.getenv('FAKE_NEVER_READY') or count<int(os.getenv('FAKE_READY_AFTER','1')) else 0)
if 'pg_dump' in args:
    (root/'dump_started').touch()
    time.sleep(float(os.getenv('FAKE_DUMP_SLEEP','0')))
    if os.getenv('FAKE_DUMP_FAIL'):
        sys.stdout.write('-- salida parcial\n' if os.getenv('FAKE_PARTIAL') else '')
        sys.stderr.write('ERROR simulado de pg_dump\n')
        sys.exit(17)
    if not os.getenv('FAKE_EMPTY'):
        sys.stdout.write('-- PostgreSQL database dump\nCREATE TABLE prueba (id integer);\n-- PostgreSQL database dump complete\n')
    sys.exit(0)
sys.exit(2)
'''

GZIP = r'''#!/usr/bin/env python3
import os,sys
if '-c' in sys.argv and os.getenv('FAKE_GZIP_FAIL'):
    sys.stdout.write('compresion parcial')
    sys.exit(1)
if '-c' in sys.argv and os.getenv('FAKE_GZIP_CORRUPT'):
    sys.stdin.buffer.read()
    sys.stdout.write('gzip invalido')
    sys.exit(0)
os.execv(os.environ['REAL_GZIP'],[os.environ['REAL_GZIP']]+sys.argv[1:])
'''

CONTROL = r'''#!/usr/bin/env python3
import os,sys
from pathlib import Path
root=Path(os.environ['QA_ROOT']);name=Path(sys.argv[0]).name;args=sys.argv[1:]
with (root/'control_calls').open('a') as f: f.write(name+' '+' '.join(args)+'\n')
if name=='id': print('0');sys.exit(0)
if name=='crontab':
    file=root/'crontab'
    if args==['-l']:
        if os.getenv('FAKE_CRON_ERROR'):
            sys.stderr.write('permission denied\n');sys.exit(1)
        if not file.exists():
            sys.stderr.write('no crontab for root\n');sys.exit(1)
        sys.stdout.write(file.read_text());sys.exit(0)
    file.write_text(Path(args[0]).read_text());sys.exit(0)
if name=='systemctl':
    if args and args[0]=='start' and os.getenv('FAKE_START_FAIL'): sys.exit(1)
    if args and args[0]=='enable' and os.getenv('FAKE_ENABLE_FAIL'): sys.exit(1)
    sys.exit(0)
if name=='systemd-analyze': sys.exit(0)
sys.exit(1)
'''

class Base(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.bin=self.root/'bin';self.bin.mkdir()
        self.backups=self.root/'backups'
        self.env={**os.environ,'QA_ROOT':str(self.root),'CLINIX_BACKUP_DIR':str(self.backups),
                  'CLINIX_BACKUP_WAIT_SECONDS':'0','CLINIX_BACKUP_LOCK_SECONDS':'0',
                  'CLINIX_BACKUP_POLL_SECONDS':'1','REAL_GZIP':shutil.which('gzip'),
                  'PATH':str(self.bin)+os.pathsep+os.environ['PATH']}
        self.executable('podman',PODMAN);self.executable('gzip',GZIP)
    def executable(self,name,code):
        p=self.bin/name;p.write_text(code);p.chmod(0o755)
    def run_backup(self,**extra):
        return subprocess.run(['bash',str(PACKAGE/'respaldo_clinix.sh')],env={**self.env,**extra},capture_output=True,text=True,timeout=15)
    def archives(self):return list(self.backups.glob('clinix_backup_*.sql.gz'))
    def log(self):return (self.backups/'respaldos.log').read_text()
    def old_copy(self,name='clinix_backup_antiguo.sql.gz'):
        self.backups.mkdir(exist_ok=True);p=self.backups/name;p.write_bytes(gzip.compress(SQL))
        old=time.time()-40*86400;os.utime(p,(old,old));return p
    def assert_no_partial(self):self.assertEqual(list(self.backups.glob('*.part')),[])

class BackupTests(Base):
    def test_success_valid_gzip_and_private_permissions(self):
        result=self.run_backup();self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(len(self.archives()),1)
        p=self.archives()[0];self.assertEqual(gzip.decompress(p.read_bytes()),SQL)
        self.assertEqual(stat.S_IMODE(p.stat().st_mode),0o600)
        self.assertEqual(stat.S_IMODE(self.backups.stat().st_mode),0o700)
        self.assertIn('RESPALDO COMPLETADO',self.log());self.assert_no_partial()
    def test_failed_dump_with_empty_output_is_not_success(self):
        old=self.old_copy();result=self.run_backup(FAKE_DUMP_FAIL='1')
        self.assertNotEqual(result.returncode,0);self.assertTrue(old.exists())
        self.assertEqual(len(self.archives()),1)
        self.assertNotIn('RESPALDO COMPLETADO',self.log());self.assertIn('ERROR simulado',self.log());self.assert_no_partial()
    def test_failed_dump_with_partial_sql_is_not_success(self):
        result=self.run_backup(FAKE_DUMP_FAIL='1',FAKE_PARTIAL='1')
        self.assertNotEqual(result.returncode,0);self.assertEqual(self.archives(),[]);self.assert_no_partial()
    def test_zero_byte_export_is_rejected_even_with_success_status(self):
        result=self.run_backup(FAKE_EMPTY='1');self.assertNotEqual(result.returncode,0)
        self.assertEqual(self.archives(),[]);self.assert_no_partial()
    def test_compression_failure_never_publishes_archive(self):
        old=self.old_copy();result=self.run_backup(FAKE_GZIP_FAIL='1')
        self.assertNotEqual(result.returncode,0);self.assertEqual(self.archives(),[old]);self.assert_no_partial()
    def test_invalid_gzip_never_publishes_archive(self):
        result=self.run_backup(FAKE_GZIP_CORRUPT='1')
        self.assertNotEqual(result.returncode,0);self.assertEqual(self.archives(),[]);self.assert_no_partial()
    def test_postgres_unavailable_never_exports_or_cleans_old_backups(self):
        old=self.old_copy();result=self.run_backup(FAKE_NEVER_READY='1')
        self.assertNotEqual(result.returncode,0);self.assertTrue(old.exists())
        self.assertNotIn('pg_dump',(self.root/'podman_calls').read_text())
    def test_waits_for_postgres_before_export(self):
        result=self.run_backup(FAKE_READY_AFTER='2',CLINIX_BACKUP_WAIT_SECONDS='5')
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual((self.root/'ready_count').read_text(),'2')
        self.assertEqual(len(self.archives()),1)
    def test_retention_deletes_only_eligible_files_after_success(self):
        old=self.old_copy();unrelated=self.old_copy('otra_base.sql.gz')
        outside=self.root/'fuera.sql.gz';outside.write_bytes(b'no borrar')
        link=self.backups/'clinix_backup_enlace.sql.gz';link.symlink_to(outside)
        result=self.run_backup();self.assertEqual(result.returncode,0,result.stderr)
        self.assertFalse(old.exists());self.assertTrue(unrelated.exists())
        self.assertTrue(outside.exists());self.assertTrue(link.is_symlink())
    def test_concurrent_invocations_are_locked(self):
        first=subprocess.Popen(['bash',str(PACKAGE/'respaldo_clinix.sh')],env={**self.env,'FAKE_DUMP_SLEEP':'2'},stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        self.addCleanup(lambda: first.kill() if first.poll() is None else None)
        limit=time.monotonic()+5
        while not (self.root/'dump_started').exists() and time.monotonic()<limit:time.sleep(.02)
        self.assertTrue((self.root/'dump_started').exists())
        second=self.run_backup();self.assertNotEqual(second.returncode,0)
        out,err=first.communicate(timeout=8);self.assertEqual(first.returncode,0,err)
        self.assertEqual(len(self.archives()),1)
    def test_two_runs_do_not_overwrite_previous_backup(self):
        one=self.run_backup();self.assertEqual(one.returncode,0,one.stderr)
        first=self.archives()[0];content=first.read_bytes()
        two=self.run_backup();self.assertEqual(two.returncode,0,two.stderr)
        self.assertEqual(len(self.archives()),2);self.assertEqual(first.read_bytes(),content)

class InstallerTests(Base):
    CRON='# comentario del respaldo\n0 2 * * * /bin/bash /root/clinix/respaldo_clinix.sh >/dev/null 2>&1\n15 3 * * * /root/otra_tarea.sh\n# /bin/bash /root/clinix/respaldo_clinix.sh desactivado\n'
    def setUp(self):
        super().setUp()
        for name in ['systemctl','crontab','systemd-analyze','id']:self.executable(name,CONTROL)
        self.host=self.root/'host';self.target=self.host/'root/clinix';self.target.mkdir(parents=True)
        self.original=self.target/'respaldo_clinix.sh';self.original.write_text('# script anterior\n')
        (self.root/'crontab').write_text(self.CRON)
    def install(self,**extra):
        return subprocess.run(['bash',str(PACKAGE/'instalar.sh')],env={**self.env,'CLINIX_INSTALL_ROOT':str(self.host),**extra},capture_output=True,text=True,timeout=10)
    def test_preserves_other_jobs_and_original_script(self):
        result=self.install();self.assertEqual(result.returncode,0,result.stderr)
        cron=(self.root/'crontab').read_text();self.assertIn('otra_tarea.sh',cron)
        self.assertIn('# /bin/bash /root/clinix/respaldo_clinix.sh desactivado',cron)
        self.assertNotIn('0 2 * * * /bin/bash',cron)
        self.assertEqual(next(self.target.glob('respaldo_clinix.sh.anterior_*')).read_text(),'# script anterior\n')
        self.assertEqual(next(self.target.glob('crontab_antes_respaldo_*')).read_text(),self.CRON)
        calls=(self.root/'control_calls').read_text()
        self.assertLess(calls.index('systemctl start'),calls.index('systemctl enable'))
    def test_failed_initial_backup_keeps_old_schedule(self):
        result=self.install(FAKE_START_FAIL='1');self.assertNotEqual(result.returncode,0)
        self.assertEqual((self.root/'crontab').read_text(),self.CRON)
        self.assertNotIn('systemctl enable',(self.root/'control_calls').read_text())
    def test_failed_timer_enable_keeps_old_schedule(self):
        result=self.install(FAKE_ENABLE_FAIL='1');self.assertNotEqual(result.returncode,0)
        self.assertEqual((self.root/'crontab').read_text(),self.CRON)
    def test_unreadable_crontab_aborts_before_overwriting_script(self):
        result=self.install(FAKE_CRON_ERROR='1');self.assertNotEqual(result.returncode,0)
        self.assertEqual(self.original.read_text(),'# script anterior\n')
        self.assertEqual((self.root/'crontab').read_text(),self.CRON)
    def test_install_with_no_previous_crontab(self):
        (self.root/'crontab').unlink();result=self.install()
        self.assertEqual(result.returncode,0,result.stderr);self.assertEqual((self.root/'crontab').read_text(),'')

if __name__=='__main__':unittest.main(verbosity=2)
