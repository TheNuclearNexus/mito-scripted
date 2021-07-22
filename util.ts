import * as fs from 'fs';

export function fileExists(path: string): boolean  {
    try{
        let s = fs.statSync(path)
        return s.isFile()
    } catch {
        return false;
    }
}

export function dirExists(path: string): boolean  {
    try{
        let s = fs.statSync(path)
        return s.isDirectory()
    } catch {
        return false;
    }
}