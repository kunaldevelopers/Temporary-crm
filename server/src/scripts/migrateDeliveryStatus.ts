import mongoose from 'mongoose';
import { DailyDelivery } from '../models/DailyDelivery';
import { Client } from '../models/Client';
import { config } from '../config';

const migrateDeliveryStatus = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB');

    // Update DailyDelivery records
    const dailyDeliveryResult = await DailyDelivery.updateMany(
      { deliveryStatus: { $in: ['delivered', 'not_delivered'] } },
      [
        {
          $set: {
            deliveryStatus: {
              $switch: {
                branches: [
                  { case: { $eq: ['$deliveryStatus', 'delivered'] }, then: 'Delivered' },
                  { case: { $eq: ['$deliveryStatus', 'not_delivered'] }, then: 'Not_Delivered' }
                ],
                default: '$deliveryStatus'
              }
            }
          }
        }
      ]
    );

    // Update Client records
    const clientResult = await Client.updateMany(
      { deliveryStatus: { $in: ['Delivered', 'Not Delivered', 'delivered', 'not_delivered'] } },
      [
        {
          $set: {
            deliveryStatus: {
              $switch: {
                branches: [
                  { case: { $eq: ['$deliveryStatus', 'delivered'] }, then: 'Delivered' },
                  { case: { $eq: ['$deliveryStatus', 'not_delivered'] }, then: 'Not_Delivered' },
                  { case: { $eq: ['$deliveryStatus', 'Not Delivered'] }, then: 'Not_Delivered' }
                ],
                default: '$deliveryStatus'
              }
            }
          }
        }
      ]
    );

    // Update delivery history in Client records
    await Client.updateMany(
      { 'deliveryHistory.status': { $in: ['delivered', 'not_delivered', 'Not Delivered'] } },
      [
        {
          $set: {
            deliveryHistory: {
              $map: {
                input: '$deliveryHistory',
                as: 'record',
                in: {
                  $mergeObjects: [
                    '$$record',
                    {
                      status: {
                        $switch: {
                          branches: [
                            { case: { $eq: ['$$record.status', 'delivered'] }, then: 'Delivered' },
                            { case: { $eq: ['$$record.status', 'not_delivered'] }, then: 'Not_Delivered' },
                            { case: { $eq: ['$$record.status', 'Not Delivered'] }, then: 'Not_Delivered' }
                          ],
                          default: '$$record.status'
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      ]
    );

    console.log('Migration completed successfully');
    console.log(`Updated ${dailyDeliveryResult.modifiedCount} daily delivery records`);
    console.log(`Updated ${clientResult.modifiedCount} client records`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateDeliveryStatus();