const fs = require('fs');

fetch('https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_municipalities_topo_simple.json')
  .then(res => res.json())
  .then(data => {
    fs.writeFileSync('topo_test_result.txt', JSON.stringify(Object.keys(data.objects)));
  })
  .catch(err => console.error(err));
