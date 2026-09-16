const fs = require('fs');
let code = fs.readFileSync('/Users/macbook/Documents/KLAIM.ID/admin.html', 'utf8');

function removeFunction(code, funcStartStr, nextFuncStr) {
    const startIdx = code.indexOf(funcStartStr);
    if (startIdx !== -1) {
        let endIdx = code.indexOf(nextFuncStr, startIdx);
        if (endIdx === -1) {
            // If nextFuncStr is not provided or not found, try to find the closing brace by counting braces.
            let braces = 0;
            let i = code.indexOf('{', startIdx);
            if (i !== -1) {
                braces = 1;
                i++;
                while (i < code.length && braces > 0) {
                    if (code[i] === '{') braces++;
                    else if (code[i] === '}') braces--;
                    i++;
                }
                endIdx = i;
            }
        }
        if (endIdx !== -1) {
            return code.substring(0, startIdx) + code.substring(endIdx);
        }
    }
    return code;
}

code = removeFunction(code, 'async function fetchData(isSilent = false) {');
code = removeFunction(code, 'async function fetchPlanningData() {');
code = removeFunction(code, 'async function fetchInsights() {');
code = removeFunction(code, 'const reportJagoCache = {};'); // Wait, I shouldn't remove reportJagoCache if it's still used
code = removeFunction(code, 'async function fetchJagoData() {');
code = removeFunction(code, 'const reportNeracaCache = {};');
code = removeFunction(code, 'async function fetchNeracaData() {');

fs.writeFileSync('/Users/macbook/Documents/KLAIM.ID/admin.html', code);
console.log("Cleaned unused functions from admin.html");
