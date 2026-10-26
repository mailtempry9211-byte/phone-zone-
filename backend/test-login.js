const http = require("http");

const data = JSON.stringify({ email: "admin@phonezone.local", password: "password123" });

const options = {
  hostname: "127.0.0.1",
  port: 47713,
  path: "/api/auth/login",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": data.length
  }
};

const req = http.request(options, (res) => {
  let body = "";
  res.on("data", (chunk) => body += chunk);
  res.on("end", () => {
    const parsed = JSON.parse(body);
    console.log("Login response:", parsed);
    if (parsed.token) {
      const options2 = {
        hostname: "127.0.0.1",
        port: 47713,
        path: "/api/financial-years",
        method: "GET",
        headers: {
          "Cookie": "pz_session=" + parsed.token
        }
      };
      const req2 = http.request(options2, (res2) => {
        let data2 = "";
        res2.on("data", (chunk) => data2 += chunk);
        res2.on("end", () => console.log("FY response:", data2));
      });
      req2.end();
    }
  });
});

req.on("error", (e) => console.log("Error:", e));
req.write(data);
req.end();