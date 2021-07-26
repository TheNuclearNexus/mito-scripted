import * as fs from 'fs';
import * as AdmZip from 'adm-zip'

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

export function getValidPacks(dir: fs.Dir) : string[] {
    let valid: string[] = []
    let entry : fs.Dirent = dir.readSync()
    while(entry != null) {        
        let entryPath: string = dir.path + '/' + entry.name;
        if(entry.isDirectory()) { // If the entry is a folder and not a file, we need to check if it is a valid datapack (if pack.mcmeta exists)
            if(fileExists(entryPath + '/pack.mcmeta')) {
                valid.push(entryPath)
            }

        } else if(entry.isFile() && entry.name.split('.').lastIndexOf('zip') != -1) {
            let zip = new AdmZip(entryPath)
            let extractPath = entryPath.substring(0, entryPath.length - 4)
            zip.extractAllTo(extractPath);

            if(fileExists(extractPath + '/pack.mcmeta')) {
                if(!(valid.includes(extractPath))) {
                    valid.push(extractPath)
                }
            }
        }


        entry = dir.readSync();
    }
    return valid
}


export interface NamespaceGroup {
    [key:string]: string[]
}

export interface NamespaceKey {
    [key:string]: Namespace
}

export class Namespace {
    data: NamespaceGroup = {}

    public toString() : string {
        let str:string = ""        

        for(let d in this.data) {

            let words : string[] = d.split('_')
            for(let j = 0; j < words.length; j++) {
                words[j] = words[j][0].toUpperCase() + words[j].substring(1)
            }
            if(!words[words.length - 1].endsWith('s'))
                words[words.length - 1] += 's'

            if(this.data[d].length != 0) str += `\t\t- ${words.join(' ')}: ${this.data[d].length}\n`
        }

        return str;
    }
}

export class Pack {
    name: string
    namespaces: NamespaceKey = {}
    constructor(name:string) {
        this.name = name
    }

    public toString() : string {
        let str : string = this.name + ":\n"

        for(let n in this.namespaces) {
            str += `\t${n}:\n${this.namespaces[n].toString()}`
        }


        return str
    }
}

export function readDir(path : string, loop : (entry: fs.Dirent) => void) {
    let content: fs.Dir = fs.opendirSync(path);

    let entry = content.readSync()
    while(entry != null) {
        loop(entry)

        entry = content.readSync()
    }
}

export function getExtension(name: string) : string {
    let parts = name.split('.')
    return parts[parts.length - 1]
} 

export function toOutputPath(path: string, folder: string, type : 'resourcepack'|'datapack'): string {
    if(folder[folder.length - 1] == '/')
        path = path.replace(folder, `output/${type}/`)
    else 
        path = path.replace(folder, `output/${type}`)

    let parts: string[] = path.split('/')

    parts.splice(2,1)

    return parts.join('/')
}

export interface ConflictDict {
    [key: string]: string[]
}

export function buildFinalPack(packs : Pack[], packsFolder : string, type: 'resourcepack'|'datapack', handler?: (namespace : string, folder : string, oPath : string, file : string, conflicts : ConflictDict) => void) : ConflictDict{
    if(dirExists(`output/${type}`)) {
        fs.rmdirSync(`output/${type}`, {recursive: true})
    }
    fs.mkdirSync(`output/${type}`)
    fs.mkdirSync(`output/${type}/${type == 'datapack' ? 'data' : 'assets'}`)

    let finalPack: Pack = new Pack("output")
    packs.forEach(d => {
        for(let n in d.namespaces) {
            if (finalPack.namespaces[n] == null) {
                finalPack.namespaces[n] = d.namespaces[n]
            } else {
                for(let f in d.namespaces[n].data) {
                    if(finalPack.namespaces[n].data[f] == null) {
                        finalPack.namespaces[n].data[f] = d.namespaces[n].data[f]
                    } else {
                        finalPack.namespaces[n].data[f] = finalPack.namespaces[n].data[f].concat(d.namespaces[n].data[f])
                    }
                }
            }
        }

    })

    //fs.writeFileSync('debug.json', JSON.stringify(finalPack, null, 2))
    let conflicts : ConflictDict = {}

    for(let n in finalPack.namespaces) {
        for(let f in finalPack.namespaces[n].data) {
            finalPack.namespaces[n].data[f].forEach(file => {
                let outPath = toOutputPath(file,packsFolder,type)
                if(conflicts[outPath] == null) {
                    conflicts[outPath] = [file]
                }

                let paths: string[] = outPath.split('/')

                if(!dirExists(paths.slice(0, paths.length-1).join('/'))) {
                    for(let i = 0; i < paths.length - 1; i++) {
                        let folder = paths.slice(0, i + 1).join('/')
                        if(!dirExists(folder)) fs.mkdirSync(folder)
                    }
                }

                if(!fileExists(outPath)) {
                    fs.copyFileSync(file, outPath)
                } else {
                    handler(n, f, outPath, file, conflicts)
                }

            })
        }
    }

    return conflicts
}