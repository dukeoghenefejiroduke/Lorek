require('dotenv').config();
const mongoose = require('mongoose');
const Proverb = require('./src/models/Proverb');
const Language = require('./src/models/Language');

async function fixProverbs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const izonLanguage = await Language.findOne({ code: 'IZON' });
    if (!izonLanguage) {
      console.error('IZON language not found');
      process.exit(1);
    }


    const result = await Proverb.updateMany(
      { $or: [ { language_id: { $exists: false } }, { language_id: null } ] },
      { $set: { language_id: izonLanguage._id } }
    );


    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixProverbs();
