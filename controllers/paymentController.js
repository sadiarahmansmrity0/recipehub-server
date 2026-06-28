const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/Payment');
const User = require('../models/User');
const Recipe = require('../models/Recipe');

// Create Premium Checkout Session - UPDATED
exports.createPremiumCheckout = async (req, res) => {
    try {
        const { success_url, cancel_url } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('👤 Creating premium checkout for:', user.email);
        console.log('📊 Current premium status:', user.isPremium);

        // Check if already premium
        if (user.isPremium) {
            return res.status(400).json({ message: 'You are already a premium member' });
        }

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'RecipeHub Premium Membership',
                            description: 'Unlimited recipe uploads and premium features',
                            images: ['https://via.placeholder.com/100/FFD700/FFFFFF?text=Premium']
                        },
                        unit_amount: 999, // $9.99
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: success_url || `${process.env.CLIENT_URL}/dashboard/premium/success`,
            cancel_url: cancel_url || `${process.env.CLIENT_URL}/dashboard/premium`,
            customer_email: user.email,
            metadata: {
                userId: user._id.toString(),
                type: 'premium'
            }
        });

        console.log('✅ Premium checkout session created:', session.id);
        res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
        console.error('❌ Premium checkout error:', error);
        res.status(500).json({ message: 'Failed to create checkout session' });
    }
};

// Create Recipe Purchase Checkout
exports.createRecipePurchase = async (req, res) => {
    try {
        const { recipeId, success_url, cancel_url } = req.body;
        const user = await User.findById(req.user.id);
        const recipe = await Recipe.findById(recipeId);

        if (!user || !recipe) {
            return res.status(404).json({ message: 'User or recipe not found' });
        }

        // Check if user already purchased this recipe
        const existingPayment = await Payment.findOne({
            userId: user._id,
            recipeId: recipe._id,
            paymentStatus: 'completed'
        });

        if (existingPayment) {
            return res.status(400).json({ message: 'You already purchased this recipe' });
        }

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: recipe.recipeName,
                            description: `Recipe: ${recipe.recipeName} by ${recipe.authorName}`,
                            images: [recipe.recipeImage || 'https://your-domain.com/recipe-placeholder.jpg']
                        },
                        unit_amount: Math.round(recipe.price * 100), // Convert to cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: success_url || `${process.env.CLIENT_URL}/recipes/${recipeId}`,
            cancel_url: cancel_url || `${process.env.CLIENT_URL}/recipes/${recipeId}`,
            customer_email: user.email,
            metadata: {
                userId: user._id.toString(),
                recipeId: recipe._id.toString(),
                type: 'recipe'
            }
        });

        res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
        console.error('Recipe purchase error:', error);
        res.status(500).json({ message: 'Failed to create purchase session' });
    }
};

// Get Purchased Recipes
exports.getPurchasedRecipes = async (req, res) => {
    try {
        const payments = await Payment.find({
            userId: req.user.id,
            paymentStatus: 'completed',
            type: 'recipe'
        });

        const recipeIds = payments.map(p => p.recipeId);
        const recipes = await Recipe.find({
            _id: { $in: recipeIds },
            status: 'published'
        }).populate('authorId', 'name email image');

        res.json(recipes);
    } catch (error) {
        console.error('Get purchased recipes error:', error);
        res.status(500).json({ message: 'Failed to fetch purchased recipes' });
    }
};

// Webhook Handler - UPDATED with better logging
exports.handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('📨 Webhook event received:', event.type);
    console.log('📦 Event data:', JSON.stringify(event.data.object, null, 2));

    switch (event.type) {
        case 'checkout.session.completed':
            await handleCheckoutCompleted(event.data.object);
            break;
        case 'payment_intent.succeeded':
            await handlePaymentSucceeded(event.data.object);
            break;
        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
};

async function handleCheckoutCompleted(session) {
    try {
        console.log('💰 Checkout completed:', session.id);
        console.log('📋 Session metadata:', session.metadata);
        console.log('📧 Customer email:', session.customer_email || session.customer_details?.email);

        const { userId, recipeId, type } = session.metadata || {};
        
        if (!userId) {
            console.error('❌ No userId in metadata!');
            return;
        }

        console.log(`👤 User ID: ${userId}, Type: ${type}, Recipe: ${recipeId || 'N/A'}`);

        // Check if payment already exists
        const existingPayment = await Payment.findOne({ transactionId: session.id });
        if (existingPayment) {
            console.log('⚠️ Payment already processed:', session.id);
            return;
        }

        // Create payment record
        const payment = new Payment({
            userId,
            userEmail: session.customer_email || session.customer_details?.email || 'unknown',
            amount: session.amount_total / 100,
            currency: session.currency || 'usd',
            transactionId: session.id,
            paymentStatus: 'completed',
            type: type || 'recipe',
            recipeId: recipeId || null,
            paymentIntentId: session.payment_intent,
            metadata: session.metadata || {}
        });

        await payment.save();
        console.log('✅ Payment saved:', session.id);

        // Handle different payment types
        if (type === 'premium') {
            console.log('👑 Upgrading user to premium:', userId);
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                {
                    isPremium: true,
                    premiumExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
                },
                { new: true }
            );
            console.log('✅ User upgraded:', updatedUser?.email, 'isPremium:', updatedUser?.isPremium);
        }

        if (type === 'recipe' && recipeId) {
            console.log('📖 Recipe purchased:', recipeId, 'by user:', userId);
        }
    } catch (error) {
        console.error('❌ Error handling checkout:', error);
    }
}

async function handlePaymentSucceeded(paymentIntent) {
    console.log('Payment succeeded:', paymentIntent.id);
}