export const PAYMONGO_CONFIG = {
    publicKey: process.env.PAYMONGO_PUBLIC_KEY || 'your_public_key_here', // Add your PayMongo public key to environment variables
    secretKey: process.env.PAYMONGO_SECRET_KEY || 'your_secret_key_here', // Add your PayMongo secret key to environment variables
    apiUrl: 'https://api.paymongo.com/v1'
};
