var assert = require('assert');
var printer = require('../');
var fs = require('fs');
var path = require('path');
var mapnik = require('mapnik');

// defaults
var zoom = 5,
    scale = 4,
    x = 4096,
    y = 4096,
    quality = 256,
    format = 'png';
    limit = 19008;

describe('Get center from bbox', function(){
    it('should fail if (x1, y1) and (x2,y2) are equal', function(done){
        var bbox = [0, 0, 0, 0];

        assert.throws( function(){
            printer.coordsFromBbox(zoom, scale, bbox, limit);
        }, /Incorrect coordinates/);
        done();
    });
    it('should fail if the image is too large', function(done){
        var bbox = [-60, -60, 60, 60];

        assert.throws( function(){
            printer.coordsFromBbox(7, 2, bbox, limit);
        }, /Desired image is too large./);
        done();
    });
    it('should return the correct coordinates', function(done){
        var bbox = [-60, -60, 60, 60];

        var center = printer.coordsFromBbox(zoom, scale, bbox, limit);
        assert.deepEqual(center.w, 10920);
        assert.deepEqual(center.h, 13736);
        assert.deepEqual(center.x, x);
        assert.deepEqual(center.y, y);
        done();
    });
});

describe('get coordinates from center', function(){
    it('should should fail if the image is too large', function(done){
        var center = {
            x: 0,
            y: 0,
            w: 4752,
            h: 4752
        };
        assert.throws( function(){
            printer.coordsFromCenter(zoom, scale, center, limit);
        }, /Desired image is too large./);
        done();
    });
    it('should return correct origin coords', function(done){
        var center = {
            x: 0,
            y: 20,
            w: 800,
            h: 800
        };
        center = printer.coordsFromCenter(zoom, scale, center, limit);
        assert.equal(center.x, x);
        assert.equal(center.y, 3631);
        done();
    });
});

describe('create list of tile coordinates', function(){
    var center =  {x: x, y: y, w: 1824, h: 1832 };

    var expectedCoords = {
        tiles: [{ z: 5, x: 15, y: 15, px: -112, py: -108 },
                { z: 5, x: 15, y: 16, px: -112, py: 916 },
                { z: 5, x: 16, y: 15, px: 912, py: -108 },
                { z: 5, x: 16, y: 16, px: 912, py: 916 } ],
        dimensions: { x: 1824, y: 1832 },
        center: { row: 16, column: 16, zoom: 5 },
        scale: 4
    };
    it('should return a tiles object with correct coords', function(done){
        var coords = printer.tileList(zoom, scale, center);
        assert.deepEqual(JSON.stringify(coords), JSON.stringify(expectedCoords));
        done();
    });
});

describe('stitch tiles into single png', function(){
    var expectedCoords = {
        tiles: [ { z: 1, x: 0, y: 0, px: 0, py: 0 },
                 { z: 1, x: 0, y: 1, px: 0, py: 256 },
                 { z: 1, x: 1, y: 0, px: 256, py: 0 },
                 { z: 1, x: 1, y: 1, px: 256, py: 256 }],
            dimensions: { x: 512, y: 512 },
            center: { row: 1, column: 1, zoom: 1 },
            scale: 2
        };

    it('should fail if no coordinates object', function(done){
        printer.stitchTiles(null, format, quality, function(){}, function(err){
            assert.equal(err.message, 'No coords object.');
            done();
        });
    });
    it('should return tiles and stitch them together', function(done){
        printer.stitchTiles(expectedCoords, format, quality, getTileTest, function(err, image, header){
            var actual = new mapnik.Image.fromBytes(image);
            var expected = new mapnik.Image.fromBytes(expectedImage);
            var max_diff_pixels = 0;
            var compare_alpha = true;
            var threshold = 16;
            var diff_pixels = actual.compare(expected,{threshold:threshold,alpha:compare_alpha});
            if (diff_pixels > max_diff_pixels) {
                expected.save("test/fixtures/expected.fail.png");
            }
            assert.equal(max_diff_pixels,diff_pixels);
            done();
        });
    });
});

var expectedImage = fs.readFileSync(path.resolve(__dirname + '/fixtures/expected.png'));
var tiles = fs.readdirSync(path.resolve(__dirname + '/fixtures')).reduce(function(memo, basename) {
                var key = basename.split('.').slice(0,3).join('.');
                memo[key] = fs.readFileSync(path.resolve(__dirname + '/fixtures/' + basename));
                return memo;
            }, {});

function getTileTest(z,x,y,callback) {
    var key = [z,x,y].join('.');

    // Headers.
    var headers = {
        'Last-Modified': new Date().toUTCString(),
        'ETag':'73f12a518adef759138c142865287a18',
        'Content-Type':'application/x-protobuf'
    };

    if (!tiles[key]) {
        return callback(new Error('Tile does not exist'));
    } else {
        return callback(null, tiles[key], headers);
    }
}
