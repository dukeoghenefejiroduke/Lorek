const mongoose = require('mongoose');
const User = require('./src/models/User'); 
const FriendRequest = require('./src/models/FriendRequest');

async function fix() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/izon_db');

    const dukeId = "69d291181b8d4a6d532a5096";
    const danielId = "69de21d67bca2671ba5b5cd2";

    // 1. Delete ghost requests using deleteMany (this is usually safe in FerretDB)
    await FriendRequest.deleteMany({
      $or: [
        { from: dukeId, to: danielId },
        { from: danielId, to: dukeId }
      ]
    });

    // 2. Fetch Users manually
    const duke = await User.findById(dukeId);
    const daniel = await User.findById(danielId);

    if (!duke || !daniel) {
      process.exit(1);
    }

    // 3. Modify arrays in memory (prevents duplicates)
    duke.friends = [{ user: danielId, status: 'accepted', since: new Date() }];
    daniel.friends = [{ user: dukeId, status: 'accepted', since: new Date() }];

    // 4. Save using .save() (This uses 'update' instead of 'findAndModify')
    await duke.save();
    await daniel.save();

    process.exit(0);
  } catch (err) {
    console.error("❌ Error details:", err.message);
    process.exit(1);
  }
}
fix();
