import Redis from "ioredis";
declare global {
   var redis:Redis| undefined
}
if(!global.redis){
    global.redis = new Redis(process.env.REDIS_URL!)
}
const redis = global.redis;

export default redis;