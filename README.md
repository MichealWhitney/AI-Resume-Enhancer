# AI Resume Enhancer

An AI-powered resume improvement web-app that leverages OpenAIs API to transform resumes into a more professional and impactful version

## Project Walkthrough
- I created a quick example/walkthrough of the project, you can view it by clicking on the thumbnail below
[![Watch the video](https://img.youtube.com/vi/-k0QUe4KAyY/maxresdefault.jpg)](https://www.youtube.com/watch?v=-k0QUe4KAyY)


## Overview

The AI Resume Builder allows users to upload a PDF resume, extracts its text using pdfJS-dist, interacts with OpenAI's API to enhance the extracted text content, and puts the outputted resume back together using PDFKit. 

## Features

- **Resume Upload:** Submit your resume in PDF format
- **AI Enhancement:** Interacts with OpenAI API to improve your resume content with best practices in resume writing
- **PDF Generation:** Generates a polished, downloadable PDF using PDFKit
- **Live Preview:** View the original and enhanced resume side by side

## Acknowledgements 

- **OpenAI API** https://openai.com/index/openai-api/
- **Express**: https://expressjs.com/ 
- **PDFKit:**: https://pdfkit.org/ 
- **PDFJS-dist:**: https://www.npmjs.com/package/pdfjs-dist 

## Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/MichealWhitney/AI-Resume-Enhancer.git 
   cd AI-Resume-Enhancer

2. **Install Dependencies**
- make sure you have node.js installed, then run "npm install"

3. **Get your OpenAI API Key**
- place your OpenAI API key in the .env file, label it "OPENAI_API_KEY"

4. **Run the server**
- run the server with "node server.mjs"
- navigate to http://localhost:3000.

