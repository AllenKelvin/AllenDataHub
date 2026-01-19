// backend/addAirtelTigoPlans.js
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => {
  console.log('❌ MongoDB Connection Error:', err.message);
  process.exit(1);
});

// DataPlan Schema
const dataPlanSchema = new mongoose.Schema({
  network: { type: String, required: true },
  size: { type: String, required: true },
  price: { type: Number, required: true },
  validity: { type: String, required: true },
  description: { type: String },
  popular: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const DataPlan = mongoose.model('DataPlan', dataPlanSchema);

async function addAirtelTigoPlans() {
  try {
    console.log('📝 Adding AirtelTigo plans to database...');
    
    // AirtelTigo Plans
    const airteltigoPlans = [
      { network: 'AirtelTigo', size: '1GB', price: 5.00, validity: '7 days', description: 'AirtelTigo 7-Day Bundle', popular: true },
      { network: 'AirtelTigo', size: '2GB', price: 9.50, validity: '7 days', description: 'AirtelTigo 7-Day Bundle' },
      { network: 'AirtelTigo', size: '3GB', price: 12.00, validity: '30 days', description: 'AirtelTigo Monthly Bundle' },
      { network: 'AirtelTigo', size: '5GB', price: 18.00, validity: '30 days', description: 'AirtelTigo Monthly Bundle' },
      { network: 'AirtelTigo', size: '6GB', price: 22.00, validity: '30 days', description: 'AirtelTigo Monthly Bundle' },
      { network: 'AirtelTigo', size: '10GB', price: 35.00, validity: '30 days', description: 'AirtelTigo Monthly Bundle' },
      { network: 'AirtelTigo', size: '15GB', price: 50.00, validity: '30 days', description: 'AirtelTigo Monthly Bundle' }
    ];

    // First, remove any existing AirtelTigo plans (optional)
    await DataPlan.deleteMany({ network: 'AirtelTigo' });
    console.log('🗑️ Removed existing AirtelTigo plans');
    
    // Insert new AirtelTigo plans
    const result = await DataPlan.insertMany(airteltigoPlans);
    console.log(`✅ Added ${result.length} AirtelTigo plans to database:`);
    
    result.forEach(plan => {
      console.log(`   - ${plan.network} ${plan.size}: GH₵${plan.price} (${plan.validity})`);
    });
    
    // Count total plans
    const totalPlans = await DataPlan.countDocuments();
    console.log(`\n📊 Total plans in database: ${totalPlans}`);
    
    // Show plans by network
    const networkCounts = await DataPlan.aggregate([
      { $group: { _id: '$network', count: { $sum: 1 } } }
    ]);
    
    console.log('\n📱 Plans by network:');
    networkCounts.forEach(network => {
      console.log(`   - ${network._id}: ${network.count} plans`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error adding AirtelTigo plans:', error);
    process.exit(1);
  }
}

addAirtelTigoPlans();