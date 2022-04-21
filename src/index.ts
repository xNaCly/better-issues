import express from "express"

const app = express();
const PORT =process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server started at port: ${PORT}`);
})

app.use((err, req, res, next) => {
  return res.json({
    status: 400,
    error: err,
  })
})