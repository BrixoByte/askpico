import { execSync } from 'child_process';
import fs from 'fs';
const link = fs.readFileSync('round29/.mlink', 'utf8').trim();
process.env.CDP_HOST = 'localhost:4173';
const expr = `location.href=${JSON.stringify(link)}; 'nav'`;
console.log(execSync(`node chrome_cdp.mjs eval ${JSON.stringify(expr)}`, { env: process.env }).toString());
