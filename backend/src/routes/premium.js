const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const { auth } = require('../middleware/auth');

const premiumService = require('../services/premiumService');
const { AppError } = require('../middleware/errorHandler');

const premiumLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many requests. Please slow down.' },
});

router.use(premiumLimiter);
router.use(auth);

/**
 * Get user's current plan and features
 * GET /api/premium/status
 */
router.get('/status', async (req, res, next) => {
  try {
    const userPlan = await premiumService.getUserPlan(req.userId);
    
    res.json({
      success: true,
      data: userPlan,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get pricing information
 * GET /api/premium/pricing
 */
router.get('/pricing', (req, res) => {
  res.json({
    success: true,
    data: premiumService.getPricing(),
  });
});

/**
 * Check if user has access to a feature
 * GET /api/premium/feature/:featureName
 */
router.get('/feature/:featureName', async (req, res, next) => {
  try {
    const { featureName } = req.params;
    const hasAccess = await premiumService.hasFeature(req.userId, featureName);
    
    res.json({
      success: true,
      data: {
        feature: featureName,
        hasAccess,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Check usage limit for an action
 * GET /api/premium/check-limit/:actionType
 */
router.get('/check-limit/:actionType', async (req, res, next) => {
  try {
    const { actionType } = req.params;
    const usage = await premiumService.checkUsageLimit(req.userId, actionType);
    
    res.json({
      success: true,
      data: usage,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Track usage
 * POST /api/premium/track-usage
 */
router.post('/track-usage', async (req, res, next) => {
  try {
    const { actionType, amount = 1 } = req.body;
    await premiumService.trackUsage(req.userId, actionType, amount);
    
    res.json({
      success: true,
      message: 'Usage tracked',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Create subscription (webhook or from payment provider)
 * POST /api/premium/subscribe
 */
router.post('/subscribe', async (req, res, next) => {
  try {
    const { plan, billingPeriod, paymentData } = req.body;
    
    const subscription = await premiumService.updateSubscription(
      req.userId,
      plan,
      billingPeriod,
      paymentData
    );
    
    res.json({
      success: true,
      data: subscription,
      message: `Subscribed to ${plan} plan`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Cancel subscription
 * POST /api/premium/cancel
 */
router.post('/cancel', async (req, res, next) => {
  try {
    const { immediate = false } = req.body;
    const subscription = await premiumService.cancelSubscription(req.userId, immediate);
    
    res.json({
      success: true,
      data: subscription,
      message: immediate ? 'Subscription canceled immediately' : 'Subscription will cancel at period end',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;