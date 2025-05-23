import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { GeminiAnswer } from '../../utils/types';

/**
 * Gemini回答取得API
 * URL: /api/get-gemini-answer
 * POST: クイズとスタイルを受け取り、Gemini APIで回答を生成する
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GeminiAnswer | {error: string, message?: string}>
) {
  // CORSヘッダーを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // CORS プリフライトリクエスト対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POSTリクエスト以外は拒否
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // リクエストボディを解析
    const { quiz, style } = req.body;

    if (!quiz || !style) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 言語に応じたコンテンツとスタイル名を使用
    const userLocale = req.headers['accept-language'] || 'en';
    const isJapanese = userLocale.includes('ja');
    const content = isJapanese ? quiz.content_ja : quiz.content_en;
    const styleName = isJapanese ? style.name_ja : style.name_en;
    const styleDesc = isJapanese ? style.description_ja : style.description_en;

    // Gemini APIキーを環境変数から取得
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // APIキーがない場合はモックデータを返す
      const mockContent = isJapanese
        ? `※APIキーが設定されていないため、モックデータを表示しています。${content}について、${styleName}の口調で回答します。これはGeminiのモデル回答です。`
        : `※API key is not configured, showing mock data. I'll answer about ${content} in ${styleName} style. This is a model answer from Gemini.`;
        
      return res.status(200).json({
        content: mockContent,
        avatar_url: "https://lh3.googleusercontent.com/a/ACg8ocL6It7Up3pLC6Zexk19oNK4UQTd_iIz5eXXHxWjZrBxH_cN=s48-c"
      });
    }

    // プロンプトテキスト
    const prompt =
      "以下の雑学お題について回答してください:\n\n" +
      "お題: " + content + "\n" +
      "指定された口調: " + styleName + "\n" +
      "指定口調の説明: " + styleDesc + "\n\n" +
      "注意: \n" +
      "- 回答は指定された口調で行ってください\n" +
      "- 事実に基づいた正確な情報を提供してください\n" +
      "- 回答は200〜300文字程度にしてください";

    // Gemini APIのエンドポイント
    const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

    // Gemini APIリクエスト
    const response = await axios.post(
      `${GEMINI_API_ENDPOINT}?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      }
    );

    // レスポンスからテキストを抽出
    const textResponse = response.data.candidates[0].content.parts[0].text;
    
    return res.status(200).json({
      content: textResponse.trim(),
      avatar_url: "https://lh3.googleusercontent.com/a/ACg8ocL6It7Up3pLC6Zexk19oNK4UQTd_iIz5eXXHxWjZrBxH_cN=s48-c"
    });
  } catch (error: any) {
    console.error('Error:', error);

    // フォールバックとしてモックデータを返す
    const userLocale = req.headers['accept-language'] || 'en';
    const isJapanese = userLocale.includes('ja');
    
    try {
      const { quiz, style } = req.body;
      const content = isJapanese ? quiz.content_ja : quiz.content_en;
      const styleName = isJapanese ? style.name_ja : style.name_en;
      
      const mockContent = isJapanese
        ? `※エラーが発生したため、モックデータを表示しています。${content}について、${styleName}の口調で回答します。これはGeminiのモデル回答です。エラー: ${error.message}`
        : `※An error occurred, showing mock data. I'll answer about ${content} in ${styleName} style. This is a model answer from Gemini. Error: ${error.message}`;
      
      return res.status(200).json({
        content: mockContent,
        avatar_url: "https://lh3.googleusercontent.com/a/ACg8ocL6It7Up3pLC6Zexk19oNK4UQTd_iIz5eXXHxWjZrBxH_cN=s48-c"
      });
    } catch {
      // リクエストボディの解析に失敗した場合の最終フォールバック
      const errorMsg = isJapanese
        ? "※エラーが発生したため、モックデータを表示しています。これはGeminiのモデル回答です。"
        : "※An error occurred, showing mock data. This is a model answer from Gemini.";
        
      return res.status(200).json({
        content: errorMsg,
        avatar_url: "https://lh3.googleusercontent.com/a/ACg8ocL6It7Up3pLC6Zexk19oNK4UQTd_iIz5eXXHxWjZrBxH_cN=s48-c"
      });
    }
  }
}