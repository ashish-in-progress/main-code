import mysql from "mysql2/promise";

export const db = mysql.createPool({
  host: "192.168.3.204",
  user: "cs_dev",
  password: "Code@123$",
  database: "my_stocks",
});