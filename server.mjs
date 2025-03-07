if (!Promise.withResolvers) {
  Object.defineProperty(Promise, 'withResolvers', {
    value: function() {
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    },
    writable: true,
    configurable: true,
  });
}

import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { getDocument } from 'pdfjs-dist';

dotenv.config();

const app = express();

// serve static files from the public folder and outputted_resumes folder
app.use(express.static('public'));
app.use('/outputted_resumes', express.static('outputted_resumes'));

// configure disk storage for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// Use pdfjs-dist to extract textf from the original uploaded PDF (https://www.npmjs.com/package/pdfjs-dist)
async function extractTextFromPdf(fileBuffer) {
  const uint8Array = new Uint8Array(fileBuffer);
  const loadingTask = getDocument({ data: uint8Array });
  const pdfDocument = await loadingTask.promise;
  let textContent = "";
  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    textContent += strings.join(" ") + "\n";
  }
  return textContent;
}

function getRandomColor() { // make the header of the resume a random color 
  const randomNum = Math.floor(Math.random() * 16777215);
  return '#' + randomNum.toString(16).padStart(6, '0');
}

function arrayToBulletedString(arr) {
  return arr.map(item => `• ${item}`).join('\n');
}

// Constructing the new outputted resume, using the data returned from OpenAI API
function generateStructuredPDF(resumeData, outputPath) {
  const doc = new PDFDocument({ 
    size: 'LETTER', 
    margins: { top: 50, left: 50, right: 50, bottom: 50 } 
  });
  const outStream = fs.createWriteStream(outputPath);
  doc.pipe(outStream);

  // -----------------------------
  // 1) Top Bar with Random Color
  // -----------------------------
  const topBarHeight = 90;
  const topBarColor = getRandomColor();
  doc
    .rect(0, 0, doc.page.width, topBarHeight)
    .fill(topBarColor);

  // Candidate Name
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#FFFFFF')
    .text(resumeData.header?.name || 'Name Here', 50, 20, { align: 'left' });

  // Contact Info (laid out vertically)
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#FFFFFF')
    .text(resumeData.header?.contact || 'Contact Info', 50, 45, { align: 'left' });

  // Reset for main content
  doc.fillColor('black');
  doc.y = topBarHeight + 20;

  // -----------------------------
  // 2) Helper: Draw Two-Column Section for Regular Sections 
  // Left column is headers, right column is corresponding content
  // -----------------------------
  function drawTwoColumnSection(title, content) {
    const startY = doc.y;
    // Left column: Section Title
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#000000')
      .text(title.toUpperCase(), 50, startY, {
        width: 100,
        align: 'left'
      });

    // Right column: Content (set to black)
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#000000')
      .text(content, 170, startY, {
        width: doc.page.width - 220,
        align: 'left'
      });

    const nextY = doc.y;
    // Horizontal divider between sections
    doc
      .strokeColor('#999999')
      .lineWidth(1)
      .moveTo(50, nextY + 5)
      .lineTo(doc.page.width - 50, nextY + 5)
      .stroke();
    doc.y = nextY + 15;
  }

  // -----------------------------
  // 3) Professional Summary
  // -----------------------------
  if (resumeData.professionalSummary) {
    drawTwoColumnSection('Professional Summary', resumeData.professionalSummary);
  }

  // -----------------------------
  // 4) Skills (Bullet Point)
  // -----------------------------
  if (Array.isArray(resumeData.skills) && resumeData.skills.length > 0) {
    const skillsContent = arrayToBulletedString(resumeData.skills);
    drawTwoColumnSection('Skills', skillsContent);
  }

  // -----------------------------
  // 5) Work Experience
  // -----------------------------
  if (Array.isArray(resumeData.workExperience)) {
    const startY = doc.y;
    // Left column: Header for Work Experience
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#000000')
      .text('WORK HISTORY', 50, startY, { width: 100, align: 'left' });

    // Right column: Content
    let rightColumnX = 170;
    doc.font('Helvetica').fontSize(11).fillColor('#000000');
    resumeData.workExperience.forEach((job) => {
      // Bold job title and company
      doc.font('Helvetica-Bold').text(
        `${job.jobTitle || ''} at ${job.company || ''}`, 
        rightColumnX, 
        doc.y, 
        { width: doc.page.width - 220, align: 'left' }
      );
      // Normal font for location (if available)
      if (job.location) {
        doc.font('Helvetica').text(job.location, { indent: 10 });
      }
      // Duration on its own line
      if (job.duration) {
        doc.font('Helvetica').text(job.duration, { indent: 10 });
      }
      // Bullet points for responsibilities
      if (job.bulletPoints && job.bulletPoints.length > 0) {
        job.bulletPoints.forEach(bp => {
          doc.font('Helvetica').text(`• ${bp}`, { indent: 20 });
        });
      }
      doc.moveDown();
    });
    const nextY = doc.y;
    // Horizontal divider after Work Experience
    doc
      .strokeColor('#999999')
      .lineWidth(1)
      .moveTo(50, nextY + 5)
      .lineTo(doc.page.width - 50, nextY + 5)
      .stroke();
    doc.y = nextY + 15;
  }

  // -----------------------------
  // 6) Education
  // -----------------------------
  if (Array.isArray(resumeData.education)) {
    const startY = doc.y;
    // Left column: Header for Education
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#000000')
      .text('EDUCATION', 50, startY, { width: 100, align: 'left' });

    // Right column: Education entries
    let rightColumnX = 170;
    doc.font('Helvetica').fontSize(11).fillColor('#000000');
    resumeData.education.forEach((edu) => {
      // Bold degree
      doc.font('Helvetica-Bold').text(edu.degree || '', rightColumnX, doc.y, { width: doc.page.width - 220, align: 'left' });
      // Institution in normal font (with indent)
      doc.font('Helvetica').text(edu.institution || '', { indent: 10 });
      // Graduation year as a bullet point
      if (edu.graduationYear) {
        doc.text(`• ${edu.graduationYear}`, { indent: 20 });
      }
      doc.moveDown();
    });
    const nextY = doc.y;
    doc
      .strokeColor('#999999')
      .lineWidth(1)
      .moveTo(50, nextY + 5)
      .lineTo(doc.page.width - 50, nextY + 5)
      .stroke();
    doc.y = nextY + 15;
  }

  // -----------------------------
  // 7) Certifications / Licenses (Optional)
  // -----------------------------
  if (Array.isArray(resumeData.certifications) && resumeData.certifications.length > 0) {
    const certContent = arrayToBulletedString(resumeData.certifications);
    drawTwoColumnSection('Certifications / Licenses', certContent);
  }

  // -----------------------------
  // 8) Achievements (Optional)
  // -----------------------------
  if (Array.isArray(resumeData.achievements) && resumeData.achievements.length > 0) {
    const achContent = arrayToBulletedString(resumeData.achievements);
    drawTwoColumnSection('Achievements', achContent);
  }

  // -----------------------------
  // 9) References
  // -----------------------------
  if (resumeData.references) {
    drawTwoColumnSection('References', resumeData.references);
  }

  doc.end();
  return new Promise((resolve, reject) => {
    outStream.on('finish', () => resolve());
    outStream.on('error', (err) => reject(err));
  });
}

export default generateStructuredPDF;

// API endpoint for resume improvement
app.post('/api/improve-resume', upload.single('resume'), async (req, res) => {
  console.log("Uploaded file:", req.file);
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    // read the uploaded PDF file
    const fileBuffer = fs.readFileSync(req.file.path);
    
    // extract text using pdfjs-dist
    const resumeText = await extractTextFromPdf(fileBuffer);
    
    // build the prompt for GPT to return structured JSON
    const prompt = `
You are a professional resume expert with knowledge of best practices in resume writing, Applicant Tracking Systems, and industry-specific optimizations.

Your goal is to improve the following resume by:
- Enhancing clarity, professionalism, and impact.
- Using strong action verbs and measurable achievements.
- Optimizing for ATS by incorporating industry-specific keywords.
- Prioritizing accomplishments over generic responsibilities.

IMPORTANT LAYOUT INSTRUCTIONS:
1) In the "contact" field, place each piece of contact info on its own line.
   Example:
     "contact": "Miami, Florida\\nPhone: 341-241-4500\\nEmail: philthebest@something.com"

2) For each work experience item, do NOT append the duration on the same line as the job title/company/location. Keep it separate in the "duration" field so we can render it on its own line.

3) For education, keep each entry’s details (degree, institution, graduationYear) clearly separated.
   - Bullet point the graduation year.
   - Do not include a location field in education.

4) If applicable, include an optional "certifications" field as an array of strings. List certifications or licenses if the candidate has them.

5) If applicable, include an optional "achievements" field as an array of strings. List any notable achievements.

If you believe you can add new text to improve the resume (for example, adding new skills based on the position), then do so.

Return the new version as a JSON object with the following keys:

{
  "header": {
    "name": string,
    "contact": string
  },
  "professionalSummary": string,
  "workExperience": [
    {
      "jobTitle": string,
      "company": string,
      "location": string,
      "duration": string,
      "bulletPoints": [string]
    }
  ],
  "education": [
    {
      "degree": string,
      "institution": string,
      "graduationYear": string
    }
  ],
  "skills": [string],
  "references": string,
  "certifications": [string],
  "achievements": [string]
}

Ensure the JSON is valid and do not include any additional text.

Here is the original resume text:
${resumeText}
`;

    // initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
          role: "user",
          content: prompt
        }],
        temperature: 0.7,
        max_tokens: 2000,
      });
    } catch (apiError) {
      console.error("Error calling OpenAI API:", apiError);
      return res.status(500).json({ error: "OpenAI API error", details: apiError.message });
    }
    
    const improvedResumeJson = completion.choices[0].message.content;
    console.log("GPT improved resume JSON:\n", improvedResumeJson);
    
    let structuredResume;
    try {
      structuredResume = JSON.parse(improvedResumeJson);
    } catch (parseError) {
      console.error("Error parsing structured resume JSON:", parseError);
      return res.status(500).json({ error: "Error parsing structured resume JSON", details: parseError.message });
    }
    
    // ensure the outputted_resumes folder exists
    const outputDir = path.join(process.cwd(), 'outputted_resumes');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    const outputFilename = `improved_${Date.now()}_${req.file.originalname}`;
    const outputPath = path.join(outputDir, outputFilename);
    
    // generate the formatted PDF using the structured resume data
    await generateStructuredPDF(structuredResume, outputPath);
       
    const downloadUrl = `/outputted_resumes/${outputFilename}`;
    res.json({ success: true, downloadUrl, improvedResume: improvedResumeJson });
    
  } catch (error) {
    console.error("Error in /api/improve-resume route:", error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
