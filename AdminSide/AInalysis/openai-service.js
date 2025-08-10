// openai-service.js
import OpenAI from 'https://cdn.skypack.dev/openai';

// Default system message for the hotel AI assistant
const DEFAULT_SYSTEM_MESSAGE = {
    role: "system",
    content: `You are an AI assistant for Lodge Ease, a hotel management system. You can:
    - Analyze occupancy rates and trends
    - Provide revenue insights and forecasts
    - Help with booking patterns and guest preferences
    - Suggest optimization strategies
    - Answer questions about hotel operations
    
    Please provide clear, concise responses with specific data when available.
    
    Only answer questions related to hotel management and analytics. For any off-topic questions,
    politely explain that you can only assist with hotel management related queries and suggest
    relevant topics the user could ask about instead.`
};

// Initialize OpenAI with your API key
const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    dangerouslyAllowBrowser: true // Only for development
});

// Main function to get chat completions from OpenAI
export async function getChatCompletion(message, context = []) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                DEFAULT_SYSTEM_MESSAGE,
                ...context,
                { role: "user", content: message }
            ],
            temperature: 0.7,
            max_tokens: 500,
            top_p: 0.9,
            presence_penalty: 0.6,
            frequency_penalty: 0.5
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw new Error('Failed to get response from AI assistant');
    }
}

// Function to analyze hotel metrics and provide insights
export async function analyzeHotelMetrics(metrics) {
    try {
        const prompt = `
            Based on the following hotel metrics, provide a brief analysis and recommendations:
            - Occupancy Rate: ${metrics.occupancyRate}%
            - Revenue: $${metrics.revenue}
            - Total Bookings: ${metrics.bookings}
            - Customer Satisfaction: ${metrics.satisfaction}
            
            Please provide insights on:
            1. Performance evaluation
            2. Areas for improvement
            3. Actionable recommendations
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                DEFAULT_SYSTEM_MESSAGE,
                { role: "user", content: prompt }
            ],
            temperature: 0.5,
            max_tokens: 400
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI Metrics Analysis Error:', error);
        throw new Error('Failed to analyze hotel metrics');
    }
}

// Function to generate forecasts based on historical data
export async function generateForecasts(historicalData) {
    try {
        const prompt = `
            Based on this historical data, provide a forecast for the next month:
            ${JSON.stringify(historicalData)}
            
            Include predictions for:
            1. Expected occupancy rate
            2. Revenue projection
            3. Booking volume
            4. Peak periods
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                DEFAULT_SYSTEM_MESSAGE,
                { role: "user", content: prompt }
            ],
            temperature: 0.4,
            max_tokens: 400
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI Forecast Error:', error);
        throw new Error('Failed to generate forecasts');
    }
}