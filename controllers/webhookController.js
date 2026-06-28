const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/Payment');
const User = require('../models/User');
const Recipe = require('../models/Recipe');

// Webhook handler
exports.handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            await handleCheckoutCompleted(event.data.object);
            break;
        
        case 'payment_intent.succeeded':
            await handlePaymentSucceeded(event.data.object);
            break;
        
        case 'charge.succeeded':
            await handleChargeSucceeded(event.data.object);
            break;
        
        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
};

// Handle checkout completion
async function handleCheckoutCompleted(session) {
    try {
        const { userId, recipeId, type } = session.metadata;
        
        // Create payment record
        const payment = new Payment({
            userId,
            userEmail: session.customer_email || session.customer_details.email,
            amount: session.amount_total / 100,
            currency: session.currency,
            transactionId: session.id,
            paymentStatus: 'completed',
            type: type || 'recipe',
            recipeId: recipeId || null,
            paymentIntentId: session.payment_intent
        });

        await payment.save();

        // If premium purchase
        if (type === 'premium') {
            await User.findByIdAndUpdate(userId, {
                isPremium: true,
                premiumExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
            });
        }

        console.log('Payment saved successfully:', session.id);
    } catch (error) {
        console.error('Error handling checkout:', error);
    }
}

async function handlePaymentSucceeded(paymentIntent) {
    console.log('Payment succeeded:', paymentIntent.id);
}

async function handleChargeSucceeded(charge) {
    console.log('Charge succeeded:', charge.id);
}