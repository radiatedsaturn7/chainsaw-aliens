import math
import struct
import sys
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools/campaigns'))
import terrain_tiles as terrain


def png(mode):
    # A constant 256x256 tile encoding exactly 1234.5 metres. Exercise
    # each PNG filter independently, including first-row/first-pixel edges.
    pixel=[132,210,128];previous=bytearray(768);data=bytearray()
    for _ in range(256):
        row=bytearray(pixel*256);data.append(mode)
        for i,value in enumerate(row):
            left=row[i-3] if i>=3 else 0;up=previous[i];corner=previous[i-3] if i>=3 else 0
            if mode==0:p=0
            elif mode==1:p=left
            elif mode==2:p=up
            elif mode==3:p=(left+up)//2
            else:
                guess=left+up-corner;a,b,c=abs(guess-left),abs(guess-up),abs(guess-corner)
                p=left if a<=b and a<=c else up if b<=c else corner
            data.append((value-p)&255)
        previous=row
    def chunk(kind,body):return struct.pack('>I',len(body))+kind+body+struct.pack('>I',zlib.crc32(kind+body))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',256,256,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(data))+chunk(b'IEND',b'')


class TerrainTilesTest(unittest.TestCase):
    def test_all_png_filters_decode_the_same_known_elevation(self):
        for mode in range(5):
            with self.subTest(mode=mode):
                rows=terrain.decode_png(png(mode))
                self.assertEqual(len(rows),256)
                self.assertTrue(all(value==1234.5 for row in rows for value in row))

    def test_bilinear_sampling_crosses_tile_seams(self):
        with patch.object(terrain,'tile',side_effect=lambda x,y:[[float(x)]*256 for _ in range(256)]):
            # Longitude zero lies halfway between the last pixel west of the
            # tile boundary and the first pixel east of it.
            self.assertAlmostEqual(terrain.elevation(0,0),2047.5)

    def test_invalid_png_and_no_data_are_rejected(self):
        with self.assertRaises(ValueError):terrain.decode_png(b'not a tile')
        with patch.object(terrain,'tile',return_value=[[-32768.0]*256 for _ in range(256)]):
            with self.assertRaises(ValueError):terrain.elevation(41,-71)

if __name__=='__main__':unittest.main()
