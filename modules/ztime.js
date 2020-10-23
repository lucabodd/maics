function ZT(){};

ZT.prototype.current = function(){
    var now = new Date();
    now = now.toISOString().replace(/-/g,"").replace("T","").replace(/:/g,"").slice(0,-5)+"Z"
    return now
}

ZT.prototype.convertToJs = function(ztime)
{
    converted = new Date(ztime.slice(4,6)+"/"+ztime.slice(6,8)+"/"+ztime.slice(0,4)+" "+ztime.slice(8,10)+":"+ztime.slice(10,12));
    return converted
}
ZT.prototype.hoursDiff = function(ztime)
{
    now = this.convertToJs(this.current())
    delta = this.convertToJs(ztime)
    diffTime = Math.abs(now - delta);
    diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    return diffHours;
}

module.exports = ZT;
