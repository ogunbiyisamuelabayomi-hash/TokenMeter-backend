require("dotenv").config();

const { getCurrentTime } = require("../src/utils/clock");

console.log("Test clock value:", getCurrentTime());
console.log("ISO date:", getCurrentTime().toISOString());