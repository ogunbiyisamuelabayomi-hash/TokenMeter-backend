
const crypto = require("crypto");

const verifySquadWebhook = (req, res, next) => {
  try {
    const secretKey = process.env.SQUAD_SECRET_KEY;

    if (!secretKey) {
      return res.status(500).json({
        message: "Squad secret key is missing"
      });
    }

    // Get the signature sent by Squad
    const receivedSignature =
      req.headers["x-squad-encrypted-body"];

    if (!receivedSignature) {
      return res.status(401).json({
        message: "Squad webhook signature is missing"
      });
    }

    // Generate our own HMAC SHA512 signature
    const expectedSignature = crypto
      .createHmac("sha512", secretKey)
      .update(JSON.stringify(req.body))
      .digest("hex")
      .toUpperCase();

    // Compare both signatures safely
    const receivedBuffer = Buffer.from(
      receivedSignature.toUpperCase(),
      "utf8"
    );

    const expectedBuffer = Buffer.from(
      expectedSignature,
      "utf8"
    );

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      return res.status(401).json({
        message: "Invalid Squad webhook signature"
      });
    }

    // Signature is valid. Continue to the webhook controller.
    next();
  } catch (error) {
    console.error("Squad webhook verification error:", error.message);

    return res.status(500).json({
      message: "Unable to verify Squad webhook"
    });
  }
};

module.exports = verifySquadWebhook;
