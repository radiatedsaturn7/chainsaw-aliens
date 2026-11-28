// Stage numbers are stable content identifiers. Travel order is separate so
// the map can change without renaming regions or invalidating save data.
export function campaignTravelOrder(stage) {
 return stage===5?6:stage===6?5:stage;
}

export const CAMPAIGN_REGION_ART = [
 'providence','mount-washington','laurel-highlands','ohio-river','ozarks',
 'data-center-city','route-66','pikes-peak','moki-dugway','oak-creek-canyon','angeles-crest'
];
