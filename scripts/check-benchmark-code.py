"""Execute the reviewed, recorded benchmark snippets in temporary directories.

This is not an arbitrary-code sandbox. Review snapshots before rerunning it;
never run unreviewed live model outputs through this script.
"""
import json
import pathlib
import re
import shutil
import sqlite3
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parents[1]
raw = json.loads((root / 'docs/benchmark-live-results.json').read_text())
results = []
selected = {'coding-01', 'coding-03', 'coding-04', 'coding-06', 'coding-07',
            'coding-11', 'coding-12', 'coding-14', 'coding-16', 'coding-20'}
for row in raw['results']:
    case = row['caseId']
    if case not in selected:
        continue
    blocks = re.findall(r'```(python|javascript|js|cpp)\s*\n(.*?)```', row['output'], re.S)
    if not blocks:
        results.append({'caseId': case, 'version': row['version'], 'status': 'NOT_VERIFIED', 'reason': 'No closed code block'})
        continue
    language = blocks[0][0]
    code = '\n'.join(text for lang, text in blocks if lang == language)
    expected = None
    if case == 'coding-01': expected = '30'
    if case == 'coding-03': expected = '0\n1\n2'
    if case == 'coding-06': code += '\nassert add(3, 4) == 7\nassert add(-3, -4) == -7\n'
    if case == 'coding-20': code += '\nassert is_even(0)\nassert is_even(-2)\nassert not is_even(3)\n'
    if case == 'coding-14':
        name = re.search(r'def (\w+)\(', code)[1]
        code += f'\nassert {name}(5, 0) is None\nassert {name}(5, 2) == 2.5\n'
    if case == 'coding-12':
        name = re.search(r'function (\w+)\(', code)[1]
        code += f'\nconst assert=require("node:assert/strict");assert.equal({name}(10,2),5);assert.equal(typeof {name}(10,0),"string");'
    if case == 'coding-11' and language in ('js', 'javascript'):
        code = 'const arr=[1,2,3];\n' + code
        expected = '1\n2\n3'
    with tempfile.TemporaryDirectory(prefix='aet-benchmark-') as directory:
        cwd = pathlib.Path(directory)
        if case == 'coding-04':
            for filename in ['database.db', 'database_name.db']:
                with sqlite3.connect(cwd / filename) as db:
                    db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)')
                    db.executemany('INSERT INTO users (email) VALUES (?)', [('user@example.com',), ('example@example.com',)])
        try:
            if language == 'python':
                script = cwd / 'test.py'; script.write_text(code)
                process = subprocess.run(['python3', '-I', str(script)], cwd=cwd, capture_output=True, text=True, timeout=5)
            elif language in ('javascript', 'js'):
                process = subprocess.run(['node', '-e', code], cwd=cwd, capture_output=True, text=True, timeout=5)
            elif language == 'cpp' and shutil.which('g++'):
                script = cwd / 'test.cpp'
                script.write_text('#include <iostream>\n#include <vector>\nusing namespace std;\nint main(){vector<int> arr={1,2,3};\n' + code + '\n}')
                process = subprocess.run(['g++', '-fsyntax-only', str(script)], cwd=cwd, capture_output=True, text=True, timeout=5)
            else:
                results.append({'caseId': case, 'version': row['version'], 'status': 'NOT_VERIFIED', 'reason': 'Compiler unavailable'})
                continue
            passed = process.returncode == 0 and (expected is None or process.stdout.strip() == expected)
            if case == 'coding-04': passed = passed and '@example.com' in process.stdout
            if case == 'coding-07': passed = passed and 'kesalahan' in process.stderr.lower()
            results.append({'caseId': case, 'version': row['version'], 'language': language,
                            'status': 'PASS' if passed else 'FAIL', 'returnCode': process.returncode,
                            'expectation': expected or 'Assertions / fixture behavior',
                            'diagnostic': process.stderr[-500:] if not passed else ''})
        except subprocess.TimeoutExpired:
            results.append({'caseId': case, 'version': row['version'], 'status': 'FAIL', 'reason': '5-second timeout'})
report = {'environment': 'Local Python / Node.js / g++, temporary fixtures; no production database',
          'scope': 'Only the reviewed recorded code blocks; not all possible user programs',
          'total': len(results), 'passed': sum(r['status'] == 'PASS' for r in results),
          'failed': sum(r['status'] == 'FAIL' for r in results), 'results': results}
(root / 'docs/benchmark-code-execution.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'results'}))
