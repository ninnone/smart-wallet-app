const fs = require('fs');
const path = require('path');
const tailwindcss = require('tailwindcss');
const postcss = require('postcss');

const inputFile = path.join(__dirname, '../configs/input.css');
const outputFile = path.join(__dirname, '../public/assets/css/main.css');

const inputCSS = fs.readFileSync(inputFile, 'utf8');

postcss([tailwindcss({ config: './tailwind.config.js' })])
    .process(inputCSS, { from: inputFile, to: outputFile })
    .then(result => {
        fs.writeFileSync(outputFile, result.css);
        console.log('CSS généré avec succès !');
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
