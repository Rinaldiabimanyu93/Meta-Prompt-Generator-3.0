import express from 'express';
import { GoogleGenerativeAI } from '@google/genai';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    const model = genai.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    
    res.json({ 
      response: result.response.text(),
      success: true 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Generation failed',
      success: false 
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
