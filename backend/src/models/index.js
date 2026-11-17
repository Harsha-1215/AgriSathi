const sequelize = require('../db/sequelize');

const models = {
  User: require('./User')(sequelize),
  UserRole: require('./UserRole')(sequelize),
  FarmerProfile: require('./FarmerProfile')(sequelize),
  ExpertProfile: require('./ExpertProfile')(sequelize),
  ServiceProviderProfile: require('./ServiceProviderProfile')(sequelize),
  ServiceBooking: require('./ServiceBooking')(sequelize),
  BuyerProfile: require('./BuyerProfile')(sequelize),
  UserPreference: require('./UserPreference')(sequelize),
  OtpVerification: require('./OtpVerification')(sequelize),
  RefreshToken: require('./RefreshToken')(sequelize),
  UserSession: require('./UserSession')(sequelize),
  PasswordReset: require('./PasswordReset')(sequelize),
  FarmerFarm: require('./FarmerFarm')(sequelize),
  FarmerCrop: require('./FarmerCrop')(sequelize),
  PlatformSetting: require('./PlatformSetting')(sequelize),
  HomepageFeature: require('./HomepageFeature')(sequelize),
  HomepageContent: require('./HomepageContent')(sequelize),
  PlatformAnnouncement: require('./PlatformAnnouncement')(sequelize),
  ContactMessage: require('./ContactMessage')(sequelize),
  NewsletterSubscriber: require('./NewsletterSubscriber')(sequelize),
  AssistantUsageLog: require('./AssistantUsageLog')(sequelize),
  CropDiagnosisFeedback: require('./CropDiagnosisFeedback')(sequelize),
  CropDiseaseSymptom: require('./CropDiseaseSymptom')(sequelize),
  CropDiseaseRecommendation: require('./CropDiseaseRecommendation')(sequelize),
  CropPest: require('./CropPest')(sequelize),
  AssistantConversation: require('./AssistantConversation')(sequelize),
  AssistantMessage: require('./AssistantMessage')(sequelize),
  AssistantFeedback: require('./AssistantFeedback')(sequelize),
  CropDiagnosis: require('./CropDiagnosis')(sequelize),
  CropDisease: require('./CropDisease')(sequelize),
  FarmerWeatherLocation: require('./FarmerWeatherLocation')(sequelize),
  WeatherNotificationPreference: require('./WeatherNotificationPreference')(sequelize),
  WeatherAlert: require('./WeatherAlert')(sequelize),
  WeatherObservation: require('./WeatherObservation')(sequelize),
  WeatherForecast: require('./WeatherForecast')(sequelize),
  WeatherAdvisory: require('./WeatherAdvisory')(sequelize),
  WeatherCacheMetadata: require('./WeatherCacheMetadata')(sequelize),
  FarmerLandPlot: require('./FarmerLandPlot')(sequelize),
  LandMeasurement: require('./LandMeasurement')(sequelize),
  LandMeasurementHistory: require('./LandMeasurementHistory')(sequelize),
  LandUnit: require('./LandUnit')(sequelize),
  RegionalLandUnitConversion: require('./RegionalLandUnitConversion')(sequelize),
  CalculatorHistory: require('./CalculatorHistory')(sequelize),
  CalculatorReferenceValue: require('./CalculatorReferenceValue')(sequelize),
  CalculatorUnitConversion: require('./CalculatorUnitConversion')(sequelize),
  CropCategory: require('./CropCategory')(sequelize),
  Crop: require('./Crop')(sequelize),
  CropKnowledge: require('./CropKnowledge')(sequelize),
  CropKnowledgeRevision: require('./CropKnowledgeRevision')(sequelize),
  CropGrowthStage: require('./CropGrowthStage')(sequelize),
  CropCalendar: require('./CropCalendar')(sequelize),
  CropBookmark: require('./CropBookmark')(sequelize),
  CropRecentView: require('./CropRecentView')(sequelize),
  AgriculturalRecommendation: require('./AgriculturalRecommendation')(sequelize),
  AgriVideo: require('./AgriVideo')(sequelize),
  AgriVideoCategory: require('./AgriVideoCategory')(sequelize),
  AgriVideoLike: require('./AgriVideoLike')(sequelize),
  AgriVideoBookmark: require('./AgriVideoBookmark')(sequelize),
  AgriVideoComment: require('./AgriVideoComment')(sequelize),
  AgriVideoCommentLike: require('./AgriVideoCommentLike')(sequelize),
  AgriVideoView: require('./AgriVideoView')(sequelize),
  AgriVideoReport: require('./AgriVideoReport')(sequelize),
  AgriShortsModerationLog: require('./AgriShortsModerationLog')(sequelize),
  GovernmentScheme: require('./GovernmentScheme')(sequelize),
  SchemeCategory: require('./SchemeCategory')(sequelize),
  SchemeTranslation: require('./SchemeTranslation')(sequelize),
  FarmerSavedScheme: require('./FarmerSavedScheme')(sequelize),
  FarmerSchemeApplication: require('./FarmerSchemeApplication')(sequelize),
  SchemeUpdate: require('./SchemeUpdate')(sequelize),
  SchemeAdminAuditLog: require('./SchemeAdminAuditLog')(sequelize),
  MarketplaceCategory: require('./MarketplaceCategory')(sequelize),
  MarketplaceProduct: require('./MarketplaceProduct')(sequelize),
  ProductImage: require('./ProductImage')(sequelize),
  SellerProfile: require('./SellerProfile')(sequelize),
  ShoppingCart: require('./ShoppingCart')(sequelize),
  CartItem: require('./CartItem')(sequelize),
  Wishlist: require('./Wishlist')(sequelize),
  WishlistItem: require('./WishlistItem')(sequelize),
  MarketplaceAddress: require('./MarketplaceAddress')(sequelize),
  MarketplaceOrder: require('./MarketplaceOrder')(sequelize),
  MarketplaceOrderItem: require('./MarketplaceOrderItem')(sequelize),
  OrderStatusHistory: require('./OrderStatusHistory')(sequelize),
  MarketplacePayment: require('./MarketplacePayment')(sequelize),
  ProductEnquiry: require('./ProductEnquiry')(sequelize),
  ProductReview: require('./ProductReview')(sequelize),
  ProductReport: require('./ProductReport')(sequelize),
  ProductInventoryHistory: require('./ProductInventoryHistory')(sequelize),
  MarketplaceAdminAuditLog: require('./MarketplaceAdminAuditLog')(sequelize),
  LivestockCategory: require('./LivestockCategory')(sequelize),
  LivestockBreed: require('./LivestockBreed')(sequelize),
  LivestockListing: require('./LivestockListing')(sequelize),
  LivestockImage: require('./LivestockImage')(sequelize),
  LivestockHealthRecord: require('./LivestockHealthRecord')(sequelize),
  LivestockVaccinationRecord: require('./LivestockVaccinationRecord')(sequelize),
  LivestockSellerProfile: require('./LivestockSellerProfile')(sequelize),
  LivestockWishlist: require('./LivestockWishlist')(sequelize),
  LivestockEnquiry: require('./LivestockEnquiry')(sequelize),
  LivestockEnquiryMessage: require('./LivestockEnquiryMessage')(sequelize),
  LivestockReport: require('./LivestockReport')(sequelize),
  LivestockListingView: require('./LivestockListingView')(sequelize),
  LivestockAdminAuditLog: require('./LivestockAdminAuditLog')(sequelize),
  CommodityCategory: require('./CommodityCategory')(sequelize),
  Commodity: require('./Commodity')(sequelize),
  AgriculturalMarket: require('./AgriculturalMarket')(sequelize),
  MarketPrice: require('./MarketPrice')(sequelize),
  MarketDataSource: require('./MarketDataSource')(sequelize),
  MarketSyncLog: require('./MarketSyncLog')(sequelize),
  FarmerFavoriteCommodity: require('./FarmerFavoriteCommodity')(sequelize),
  FarmerFavoriteMarket: require('./FarmerFavoriteMarket')(sequelize),
  MarketPriceAlert: require('./MarketPriceAlert')(sequelize),
};

models.User.hasMany(models.UserRole, { foreignKey: 'userId', onDelete: 'CASCADE' });
models.UserRole.belongsTo(models.User, { foreignKey: 'userId' });
models.User.hasOne(models.FarmerProfile, { foreignKey: 'userId', onDelete: 'CASCADE' });
models.FarmerProfile.belongsTo(models.User, { foreignKey: 'userId' });
models.User.hasOne(models.ExpertProfile, { foreignKey: 'userId', onDelete: 'CASCADE' });
models.ExpertProfile.belongsTo(models.User, { foreignKey: 'userId' });
models.User.hasOne(models.ServiceProviderProfile, { foreignKey: 'userId', onDelete: 'CASCADE' });
models.ServiceProviderProfile.belongsTo(models.User, { foreignKey: 'userId' });
models.User.hasMany(models.ServiceBooking, { foreignKey: 'farmerId', as: 'farmerServiceBookings', onDelete: 'CASCADE' });
models.ServiceBooking.belongsTo(models.User, { foreignKey: 'farmerId', as: 'farmer' });
models.ServiceProviderProfile.hasMany(models.ServiceBooking, { foreignKey: 'providerId', sourceKey: 'userId', onDelete: 'CASCADE' });
models.ServiceBooking.belongsTo(models.ServiceProviderProfile, { foreignKey: 'providerId', targetKey: 'userId' });
models.User.hasOne(models.BuyerProfile, { foreignKey: 'userId', onDelete: 'CASCADE' });
models.BuyerProfile.belongsTo(models.User, { foreignKey: 'userId' });
models.User.hasOne(models.SellerProfile, { foreignKey: 'userId', constraints: false });
models.SellerProfile.belongsTo(models.User, { foreignKey: 'userId', constraints: false });
models.User.hasOne(models.UserPreference, { foreignKey: 'userId', onDelete: 'CASCADE' });
models.UserPreference.belongsTo(models.User, { foreignKey: 'userId' });
models.User.hasMany(models.OtpVerification, { foreignKey: 'userId', onDelete: 'CASCADE' });
models.OtpVerification.belongsTo(models.User, { foreignKey: 'userId' });
models.User.hasMany(models.RefreshToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
models.RefreshToken.belongsTo(models.User, { foreignKey: 'userId' });
models.User.hasMany(models.UserSession, { foreignKey: 'userId', onDelete: 'CASCADE' });
models.UserSession.belongsTo(models.User, { foreignKey: 'userId' });
models.RefreshToken.hasOne(models.UserSession, { foreignKey: 'refreshTokenId', onDelete: 'CASCADE' });
models.UserSession.belongsTo(models.RefreshToken, { foreignKey: 'refreshTokenId' });
models.User.hasMany(models.PasswordReset, { foreignKey: 'userId', onDelete: 'CASCADE' });
models.PasswordReset.belongsTo(models.User, { foreignKey: 'userId' });
models.User.hasMany(models.FarmerFarm, { foreignKey: 'userId', onDelete: 'CASCADE' });
models.FarmerFarm.belongsTo(models.User, { foreignKey: 'userId' });
models.User.hasMany(models.FarmerCrop, { foreignKey: 'userId', onDelete: 'CASCADE' });
models.FarmerCrop.belongsTo(models.User, { foreignKey: 'userId' });
models.FarmerFarm.hasMany(models.FarmerCrop, { foreignKey: 'farmId', onDelete: 'SET NULL' });
models.FarmerCrop.belongsTo(models.FarmerFarm, { foreignKey: 'farmId' });
models.Crop.hasMany(models.FarmerCrop, { foreignKey: 'cropId', sourceKey: 'id', constraints: false });
models.FarmerCrop.belongsTo(models.Crop, { foreignKey: 'cropId', targetKey: 'id', constraints: false });
models.CropDiagnosis.hasMany(models.CropDiagnosisFeedback, { foreignKey: 'diagnosisId', onDelete: 'CASCADE' });
models.CropDiagnosisFeedback.belongsTo(models.CropDiagnosis, { foreignKey: 'diagnosisId' });
models.CropDisease.hasMany(models.CropDiseaseSymptom, { foreignKey: 'diseaseId', onDelete: 'CASCADE' });
models.CropDiseaseSymptom.belongsTo(models.CropDisease, { foreignKey: 'diseaseId' });
models.CropDisease.hasMany(models.CropDiseaseRecommendation, { foreignKey: 'diseaseId', onDelete: 'CASCADE' });
models.CropDiseaseRecommendation.belongsTo(models.CropDisease, { foreignKey: 'diseaseId' });

models.AssistantConversation.hasMany(models.AssistantMessage, {
  foreignKey: 'conversationId',
  onDelete: 'CASCADE',
});
models.AssistantMessage.belongsTo(models.AssistantConversation, { foreignKey: 'conversationId' });
models.AssistantMessage.hasMany(models.AssistantFeedback, {
  foreignKey: 'messageId',
  onDelete: 'CASCADE',
});
models.AssistantFeedback.belongsTo(models.AssistantMessage, { foreignKey: 'messageId' });

models.CropCategory.hasMany(models.Crop, { foreignKey: 'categoryId', onDelete: 'RESTRICT' });
models.Crop.belongsTo(models.CropCategory, { foreignKey: 'categoryId' });
models.Crop.hasMany(models.CropKnowledge, { foreignKey: 'cropId', onDelete: 'CASCADE' });
models.CropKnowledge.belongsTo(models.Crop, { foreignKey: 'cropId' });
models.CropKnowledge.hasMany(models.CropKnowledgeRevision, { foreignKey: 'knowledgeId', onDelete: 'CASCADE' });
models.CropKnowledgeRevision.belongsTo(models.CropKnowledge, { foreignKey: 'knowledgeId' });
models.Crop.hasMany(models.CropGrowthStage, { foreignKey: 'cropId', onDelete: 'CASCADE' });
models.CropGrowthStage.belongsTo(models.Crop, { foreignKey: 'cropId' });
models.Crop.hasMany(models.CropCalendar, { foreignKey: 'cropId', onDelete: 'CASCADE' });
models.CropCalendar.belongsTo(models.Crop, { foreignKey: 'cropId' });
models.Crop.hasMany(models.CropBookmark, { foreignKey: 'cropId', onDelete: 'CASCADE' });
models.CropBookmark.belongsTo(models.Crop, { foreignKey: 'cropId' });
models.Crop.hasMany(models.CropRecentView, { foreignKey: 'cropId', onDelete: 'CASCADE' });
models.CropRecentView.belongsTo(models.Crop, { foreignKey: 'cropId' });
models.Crop.hasMany(models.AgriculturalRecommendation, { foreignKey: 'cropId', onDelete: 'CASCADE' });
models.AgriculturalRecommendation.belongsTo(models.Crop, { foreignKey: 'cropId' });
models.Crop.hasMany(models.CropPest, { foreignKey: 'cropId', onDelete: 'CASCADE' });
models.CropPest.belongsTo(models.Crop, { foreignKey: 'cropId' });
models.Crop.hasMany(models.CalculatorReferenceValue, { foreignKey: 'cropId', onDelete: 'CASCADE' });
models.CalculatorReferenceValue.belongsTo(models.Crop, { foreignKey: 'cropId' });

models.FarmerLandPlot.hasMany(models.LandMeasurement, { foreignKey: 'plotId', onDelete: 'SET NULL' });
models.LandMeasurement.belongsTo(models.FarmerLandPlot, { foreignKey: 'plotId' });
models.FarmerLandPlot.hasMany(models.LandMeasurementHistory, { foreignKey: 'plotId', onDelete: 'SET NULL' });
models.LandMeasurementHistory.belongsTo(models.FarmerLandPlot, { foreignKey: 'plotId' });
models.LandUnit.hasMany(models.RegionalLandUnitConversion, { foreignKey: 'unitCode', sourceKey: 'code', onDelete: 'CASCADE' });
models.RegionalLandUnitConversion.belongsTo(models.LandUnit, { foreignKey: 'unitCode', targetKey: 'code' });

models.CommodityCategory.hasMany(models.Commodity, { foreignKey: 'categoryId', onDelete: 'SET NULL' });
models.Commodity.belongsTo(models.CommodityCategory, { foreignKey: 'categoryId' });
models.Commodity.hasMany(models.MarketPrice, { foreignKey: 'commodityId', onDelete: 'RESTRICT' });
models.MarketPrice.belongsTo(models.Commodity, { foreignKey: 'commodityId' });
models.AgriculturalMarket.hasMany(models.MarketPrice, { foreignKey: 'marketId', onDelete: 'RESTRICT' });
models.MarketPrice.belongsTo(models.AgriculturalMarket, { foreignKey: 'marketId' });
models.MarketDataSource.hasMany(models.AgriculturalMarket, { foreignKey: 'sourceId', onDelete: 'SET NULL' });
models.AgriculturalMarket.belongsTo(models.MarketDataSource, { foreignKey: 'sourceId' });
models.MarketDataSource.hasMany(models.MarketPrice, { foreignKey: 'sourceId', onDelete: 'RESTRICT' });
models.MarketPrice.belongsTo(models.MarketDataSource, { foreignKey: 'sourceId' });
models.MarketDataSource.hasMany(models.MarketSyncLog, { foreignKey: 'sourceId', onDelete: 'CASCADE' });
models.MarketSyncLog.belongsTo(models.MarketDataSource, { foreignKey: 'sourceId' });
models.Commodity.hasMany(models.FarmerFavoriteCommodity, { foreignKey: 'commodityId', onDelete: 'CASCADE' });
models.FarmerFavoriteCommodity.belongsTo(models.Commodity, { foreignKey: 'commodityId' });
models.AgriculturalMarket.hasMany(models.FarmerFavoriteMarket, { foreignKey: 'marketId', onDelete: 'CASCADE' });
models.FarmerFavoriteMarket.belongsTo(models.AgriculturalMarket, { foreignKey: 'marketId' });
models.Commodity.hasMany(models.MarketPriceAlert, { foreignKey: 'commodityId', onDelete: 'CASCADE' });
models.MarketPriceAlert.belongsTo(models.Commodity, { foreignKey: 'commodityId' });
models.AgriculturalMarket.hasMany(models.MarketPriceAlert, { foreignKey: 'marketId', onDelete: 'SET NULL' });
models.MarketPriceAlert.belongsTo(models.AgriculturalMarket, { foreignKey: 'marketId' });

models.AgriVideoCategory.hasMany(models.AgriVideo, { foreignKey: 'categoryId', onDelete: 'RESTRICT' });
models.AgriVideo.belongsTo(models.AgriVideoCategory, { foreignKey: 'categoryId' });
models.AgriVideo.belongsTo(models.Crop, { foreignKey: 'cropId', constraints: false });
models.AgriVideo.hasMany(models.AgriVideoLike, { foreignKey: 'videoId', onDelete: 'CASCADE' });
models.AgriVideoLike.belongsTo(models.AgriVideo, { foreignKey: 'videoId' });
models.AgriVideo.hasMany(models.AgriVideoBookmark, { foreignKey: 'videoId', onDelete: 'CASCADE' });
models.AgriVideoBookmark.belongsTo(models.AgriVideo, { foreignKey: 'videoId' });
models.AgriVideo.hasMany(models.AgriVideoComment, { foreignKey: 'videoId', onDelete: 'CASCADE' });
models.AgriVideoComment.belongsTo(models.AgriVideo, { foreignKey: 'videoId' });
models.AgriVideoComment.hasMany(models.AgriVideoCommentLike, { foreignKey: 'commentId', onDelete: 'CASCADE' });
models.AgriVideoCommentLike.belongsTo(models.AgriVideoComment, { foreignKey: 'commentId' });
models.AgriVideo.hasMany(models.AgriVideoView, { foreignKey: 'videoId', onDelete: 'CASCADE' });
models.AgriVideoView.belongsTo(models.AgriVideo, { foreignKey: 'videoId' });
models.AgriVideo.hasMany(models.AgriVideoReport, { foreignKey: 'videoId', onDelete: 'CASCADE' });
models.AgriVideoReport.belongsTo(models.AgriVideo, { foreignKey: 'videoId' });
models.AgriVideoComment.hasMany(models.AgriVideoReport, { foreignKey: 'commentId', onDelete: 'SET NULL' });
models.AgriVideoReport.belongsTo(models.AgriVideoComment, { foreignKey: 'commentId' });
models.AgriVideoComment.hasMany(models.AgriVideoComment, { as: 'replies', foreignKey: 'parentCommentId', onDelete: 'CASCADE' });
models.AgriVideoComment.belongsTo(models.AgriVideoComment, { as: 'parent', foreignKey: 'parentCommentId' });
models.AgriVideo.hasMany(models.AgriShortsModerationLog, { foreignKey: 'videoId', onDelete: 'SET NULL' });
models.AgriShortsModerationLog.belongsTo(models.AgriVideo, { foreignKey: 'videoId' });

models.SchemeCategory.hasMany(models.GovernmentScheme, { foreignKey: 'categoryId', onDelete: 'RESTRICT' });
models.GovernmentScheme.belongsTo(models.SchemeCategory, { foreignKey: 'categoryId' });
models.GovernmentScheme.hasMany(models.SchemeTranslation, { foreignKey: 'schemeId', onDelete: 'CASCADE' });
models.SchemeTranslation.belongsTo(models.GovernmentScheme, { foreignKey: 'schemeId' });
models.GovernmentScheme.hasMany(models.FarmerSavedScheme, { foreignKey: 'schemeId', onDelete: 'CASCADE' });
models.FarmerSavedScheme.belongsTo(models.GovernmentScheme, { foreignKey: 'schemeId' });
models.GovernmentScheme.hasMany(models.FarmerSchemeApplication, { foreignKey: 'schemeId', onDelete: 'CASCADE' });
models.FarmerSchemeApplication.belongsTo(models.GovernmentScheme, { foreignKey: 'schemeId' });
models.GovernmentScheme.hasMany(models.SchemeUpdate, { foreignKey: 'schemeId', onDelete: 'CASCADE' });
models.SchemeUpdate.belongsTo(models.GovernmentScheme, { foreignKey: 'schemeId' });

models.MarketplaceCategory.hasMany(models.MarketplaceProduct, { foreignKey: 'categoryId', onDelete: 'RESTRICT' });
models.MarketplaceProduct.belongsTo(models.MarketplaceCategory, { foreignKey: 'categoryId' });
models.SellerProfile.hasMany(models.MarketplaceProduct, { foreignKey: 'sellerId', sourceKey: 'userId', constraints: false });
models.MarketplaceProduct.belongsTo(models.SellerProfile, { foreignKey: 'sellerId', targetKey: 'userId', constraints: false });
models.MarketplaceProduct.hasMany(models.ProductImage, { foreignKey: 'productId', onDelete: 'CASCADE' });
models.ProductImage.belongsTo(models.MarketplaceProduct, { foreignKey: 'productId' });
models.ShoppingCart.hasMany(models.CartItem, { foreignKey: 'cartId', onDelete: 'CASCADE' });
models.CartItem.belongsTo(models.ShoppingCart, { foreignKey: 'cartId' });
models.MarketplaceProduct.hasMany(models.CartItem, { foreignKey: 'productId', onDelete: 'CASCADE' });
models.CartItem.belongsTo(models.MarketplaceProduct, { foreignKey: 'productId' });
models.Wishlist.hasMany(models.WishlistItem, { foreignKey: 'wishlistId', onDelete: 'CASCADE' });
models.WishlistItem.belongsTo(models.Wishlist, { foreignKey: 'wishlistId' });
models.MarketplaceProduct.hasMany(models.WishlistItem, { foreignKey: 'productId', onDelete: 'CASCADE' });
models.WishlistItem.belongsTo(models.MarketplaceProduct, { foreignKey: 'productId' });
models.MarketplaceAddress.hasMany(models.MarketplaceOrder, { foreignKey: 'addressId', onDelete: 'SET NULL' });
models.MarketplaceOrder.belongsTo(models.MarketplaceAddress, { foreignKey: 'addressId' });
models.MarketplaceOrder.hasMany(models.MarketplaceOrderItem, { foreignKey: 'orderId', onDelete: 'CASCADE' });
models.MarketplaceOrderItem.belongsTo(models.MarketplaceOrder, { foreignKey: 'orderId' });
models.MarketplaceProduct.hasMany(models.MarketplaceOrderItem, { foreignKey: 'productId', onDelete: 'SET NULL' });
models.MarketplaceOrderItem.belongsTo(models.MarketplaceProduct, { foreignKey: 'productId' });
models.MarketplaceOrder.hasMany(models.OrderStatusHistory, { foreignKey: 'orderId', onDelete: 'CASCADE' });
models.OrderStatusHistory.belongsTo(models.MarketplaceOrder, { foreignKey: 'orderId' });
models.MarketplaceOrder.hasMany(models.MarketplacePayment, { foreignKey: 'orderId', onDelete: 'CASCADE' });
models.MarketplacePayment.belongsTo(models.MarketplaceOrder, { foreignKey: 'orderId' });
models.MarketplaceProduct.hasMany(models.ProductEnquiry, { foreignKey: 'productId', onDelete: 'CASCADE' });
models.ProductEnquiry.belongsTo(models.MarketplaceProduct, { foreignKey: 'productId' });
models.MarketplaceProduct.hasMany(models.ProductReview, { foreignKey: 'productId', onDelete: 'CASCADE' });
models.ProductReview.belongsTo(models.MarketplaceProduct, { foreignKey: 'productId' });
models.MarketplaceOrderItem.hasOne(models.ProductReview, { foreignKey: 'orderItemId', onDelete: 'CASCADE' });
models.ProductReview.belongsTo(models.MarketplaceOrderItem, { foreignKey: 'orderItemId' });
models.MarketplaceProduct.hasMany(models.ProductReport, { foreignKey: 'productId', onDelete: 'CASCADE' });
models.ProductReport.belongsTo(models.MarketplaceProduct, { foreignKey: 'productId' });
models.MarketplaceProduct.hasMany(models.ProductInventoryHistory, { foreignKey: 'productId', onDelete: 'CASCADE' });
models.ProductInventoryHistory.belongsTo(models.MarketplaceProduct, { foreignKey: 'productId' });

models.LivestockCategory.hasMany(models.LivestockBreed, { foreignKey: 'categoryId', onDelete: 'RESTRICT' });
models.LivestockBreed.belongsTo(models.LivestockCategory, { foreignKey: 'categoryId' });
models.LivestockCategory.hasMany(models.LivestockListing, { foreignKey: 'categoryId', onDelete: 'RESTRICT' });
models.LivestockListing.belongsTo(models.LivestockCategory, { foreignKey: 'categoryId' });
models.LivestockBreed.hasMany(models.LivestockListing, { foreignKey: 'breedId', onDelete: 'SET NULL' });
models.LivestockListing.belongsTo(models.LivestockBreed, { foreignKey: 'breedId' });
models.LivestockSellerProfile.hasMany(models.LivestockListing, {
  foreignKey: 'sellerId',
  sourceKey: 'userId',
  constraints: false,
});
models.LivestockListing.belongsTo(models.LivestockSellerProfile, {
  foreignKey: 'sellerId',
  targetKey: 'userId',
  constraints: false,
});
models.LivestockListing.hasMany(models.LivestockImage, { foreignKey: 'listingId', onDelete: 'CASCADE' });
models.LivestockImage.belongsTo(models.LivestockListing, { foreignKey: 'listingId' });
models.LivestockListing.hasMany(models.LivestockHealthRecord, { foreignKey: 'listingId', onDelete: 'CASCADE' });
models.LivestockHealthRecord.belongsTo(models.LivestockListing, { foreignKey: 'listingId' });
models.LivestockListing.hasMany(models.LivestockVaccinationRecord, { foreignKey: 'listingId', onDelete: 'CASCADE' });
models.LivestockVaccinationRecord.belongsTo(models.LivestockListing, { foreignKey: 'listingId' });
models.LivestockListing.hasMany(models.LivestockWishlist, { foreignKey: 'listingId', onDelete: 'CASCADE' });
models.LivestockWishlist.belongsTo(models.LivestockListing, { foreignKey: 'listingId' });
models.LivestockListing.hasMany(models.LivestockEnquiry, { foreignKey: 'listingId', onDelete: 'CASCADE' });
models.LivestockEnquiry.belongsTo(models.LivestockListing, { foreignKey: 'listingId' });
models.LivestockEnquiry.hasMany(models.LivestockEnquiryMessage, { foreignKey: 'enquiryId', onDelete: 'CASCADE' });
models.LivestockEnquiryMessage.belongsTo(models.LivestockEnquiry, { foreignKey: 'enquiryId' });
models.LivestockListing.hasMany(models.LivestockReport, { foreignKey: 'listingId', onDelete: 'CASCADE' });
models.LivestockReport.belongsTo(models.LivestockListing, { foreignKey: 'listingId' });
models.LivestockListing.hasMany(models.LivestockListingView, { foreignKey: 'listingId', onDelete: 'CASCADE' });
models.LivestockListingView.belongsTo(models.LivestockListing, { foreignKey: 'listingId' });

module.exports = { sequelize, ...models };
