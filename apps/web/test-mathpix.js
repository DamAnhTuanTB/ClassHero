const { MathpixMarkdownModel } = require("mathpix-markdown-it");
const html = MathpixMarkdownModel.markdownToHTML("Hai điểm biểu diễn $\\frac{5}{4}$", { htmlTags: true });
console.log(html);
