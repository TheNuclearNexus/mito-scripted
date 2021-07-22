import * as fs from 'fs';
import * as AdmZip from 'adm-zip'
import {fileExists, dirExists} from './util'
import md5 = require('md5');

let dir: fs.Dir = null

class TagValue {
    required: boolean = false;
    value: string = ""
}

class Tag {
    replace: boolean = false;
    values = []

}

interface NamespaceGroup {
    [key:string]: string[]
}

interface NamespaceKey {
    [key:string]: Namespace
}

class Namespace {
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
class Datapack {
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

let validDatapacks: string[] = []
let datapacks: Datapack[] = []
let datapacksFolder: string

export function runDatapack(path: string) {
    path = path.split('\\').join('/')
    datapacksFolder = path
    if(fs.statSync(path).isDirectory()) {
        dir = fs.opendirSync(path)
        handleInput()
    }    
}

function handleInput() {
    let entry : fs.Dirent = dir.readSync()
    while(entry != null) {        
        let entryPath: string = dir.path + '/' + entry.name;
        if(entry.isDirectory()) { // If the entry is a folder and not a file, we need to check if it is a valid datapack (if pack.mcmeta exists)
            if(fileExists(entryPath + '/pack.mcmeta')) {
                validDatapacks.push(entryPath)
            }

        } else if(entry.isFile() && entry.name.split('.').lastIndexOf('zip') != -1) {
            let zip = new AdmZip(entryPath)
            let extractPath = entryPath.substring(0, entryPath.length - 4)
            zip.extractAllTo(extractPath);

            if(fileExists(extractPath + '/pack.mcmeta')) {
                if(!(extractPath in validDatapacks)) {
                    validDatapacks.push(extractPath)
                }
            }
        }


        entry = dir.readSync();
    }

    
    validDatapacks.forEach(element => {
        let d: Datapack = createDatapack(element)
        datapacks.push(d)
    });

    buildFinalDatapack()
}

function getFiles(path: string, ext: string, namespace: Namespace) : string[] {
    let files: string[] = []
    let content: fs.Dir = fs.opendirSync(path);

    let entry = content.readSync()
    while(entry != null) {
        if(entry.isDirectory()) {
            files = files.concat(getFiles(path + "/" + entry.name, ext, namespace))
        }
        else if(entry.isFile()) {
            let parts = entry.name.split('.')

            if(parts[parts.length-1] == ext) {
                files.push(path + "/" + entry.name)
            }
        }

        entry = content.readSync()
    }

    return files;

}

function getNamespace(path: string) : [string, Namespace] {
    var segments = path.split('/')
    let namespace = new Namespace()
    let content: fs.Dir = fs.opendirSync(path);

    let entry = content.readSync()
    while(entry != null) {
        if(entry.isDirectory()) {
            let ext = entry.name == 'functions' ? 'mcfunction' : 'json'
            namespace.data[entry.name] = getFiles(path + `/${entry.name}`, ext, namespace)
        }

        entry = content.readSync()
    }

    return [segments[segments.length - 1], namespace]
}

function createDatapack(path: string) : Datapack {

    let segments = path.split('/') 

    let data: fs.Dir = fs.opendirSync(path + "/data");
    let datapack: Datapack = new Datapack(segments[segments.length - 1])

    let entry = data.readSync();
    while(entry != null) {
        if(entry.isDirectory()) {
            var n = getNamespace(path + "/data/" + entry.name)
            datapack.namespaces[n[0]] = n[1]
        }

        entry = data.readSync()
    }

    return datapack
}

function toDatapackPath(path: string): string {
    if(datapacksFolder[datapacksFolder.length - 1] == '/')
        path = path.replace(datapacksFolder, 'output/datapack/')
    else 
        path = path.replace(datapacksFolder, 'output/datapack')

    let parts: string[] = path.split('/')

    parts.splice(2,1)

    return parts.join('/')
}

function buildFinalDatapack() {
    if(dirExists('output/datapack')) {
        fs.rmdirSync('output/datapack', {recursive: true})
    }
    fs.mkdirSync('output/datapack')
    fs.mkdirSync('output/datapack/data')

    let finalDP: Datapack = new Datapack("output")
    datapacks.forEach(d => {
        for(let n in d.namespaces) {
            if (finalDP.namespaces[n] == null) {
                finalDP.namespaces[n] = d.namespaces[n]
            } else {
                for(let f in d.namespaces[n].data) {
                    if(finalDP.namespaces[n].data[f] == null) {
                        finalDP.namespaces[n].data[f] = d.namespaces[n].data[f]
                    } else {
                        finalDP.namespaces[n].data[f] = finalDP.namespaces[n].data[f].concat(d.namespaces[n].data[f])
                    }
                }
            }
        }

    })

    //fs.writeFileSync('debug.json', JSON.stringify(finalDP, null, 2))
    let conflicts : string[] = []

    for(let n in finalDP.namespaces) {
        for(let f in finalDP.namespaces[n].data) {
            finalDP.namespaces[n].data[f].forEach(file => {
                let dpPath = toDatapackPath(file)

                let paths: string[] = dpPath.split('/')

                if(!dirExists(paths.slice(0, paths.length-1).join('/'))) {
                    for(let i = 0; i < paths.length - 1; i++) {
                        let folder = paths.slice(0, i + 1).join('/')
                        if(!dirExists(folder)) fs.mkdirSync(folder)
                    }
                }

                if(!fileExists(dpPath)) {
                    fs.copyFileSync(file, dpPath)
                } else {
                    if(f == 'tags') {
                        let tagA = JSON.parse(fs.readFileSync(dpPath).toString())
                        let tagB = JSON.parse(fs.readFileSync(file).toString())

                        for(let i = 0; i < tagB["values"].length; i++) {
                            if(!tagA["values"].includes(tagB["values"][i]))
                                tagA["values"].push(tagB["values"][i])
                        }

                        fs.writeFileSync(dpPath, JSON.stringify(tagA, null, 2))
                    } else {
                        let strA = fs.readFileSync(dpPath).toString()
                        let strB = fs.readFileSync(file).toString()

                        strA = strA.replace(/\s+/g, '')
                        strB = strB.replace(/\s+/g, '')

                        if(strA != strB) {
                            console.log('Conflict @ ' + file + '\n')
                            conflicts.push('Conflict @ ' + dpPath + '\n')
                        }
                    }
                }

            })
        }
    }

    let f : number = fs.openSync('conflicts.txt', 'w')

    for(let c in conflicts) {
        fs.writeSync(f, c)
    }

    fs.closeSync(f)
}
