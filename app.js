const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const rtmodule = require('rtmodule-windows');
const client = require('prom-client');
const os = require('os');
var path = require('path');

// 创建一个新的Gauge指标
const cpuUsage = new client.Gauge({
  name: 'cpu_usage',
  help: 'CPU usage percentage'
});

const queryRunTime = new client.Gauge({
  name: 'query_run_time',
  help: 'Query instruction run time'
});

function cpuAverage() {
  // 获取 CPU 信息
  const cpus = os.cpus();

  // 初始化总空闲时间和总时间
  let totalIdle = 0;
  let totalTick = 0;

  // 遍历每个逻辑 CPU 内核
  for (let i = 0; i < cpus.length; i++) {
    const cpu = cpus[i];

    // 获取当前 CPU 内核的各种时间
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }

  // 计算平均空闲时间和总时间
  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;

  return {
    idle,
    total,
  };
}

// 获取初始 CPU 时间
const startMeasure = cpuAverage();
// 定期更新CPU使用率指标
setInterval(() => {
  const endMeasure = cpuAverage();
  // 计算差值
  const idleDiff = endMeasure.idle - startMeasure.idle;
  const totalDiff = endMeasure.total - startMeasure.total;
  // 计算 CPU 使用率
  const usage = 1 - idleDiff / totalDiff;
  cpuUsage.set(usage);
}, 1000);

// 公开指标数据
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  const metrics = await client.register.metrics();
  res.end(metrics);
});

// 解析POST请求的正文
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/inputString', (req, res) => {
  const inputString = req.body.inputString;
  console.log(inputString);

  // 记录开始时间
  const start = process.hrtime();  
  
  //执行查询指令
  const rtLog = rtmodule.processInput(inputString);
  
  // 计算运行时间
  const diff = process.hrtime(start);
  const duration = diff[0] + diff[1] / 1e9;

  queryRunTime.set(duration);
  
  //console.log(rtLog);
  res.send(rtLog);

});

app.listen(3001, '0.0.0.0', () => {
  console.log('Server started on port 3001');
});

