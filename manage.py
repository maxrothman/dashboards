import click, boto
from os import path, listdir, walk, sep
from shutil import copytree, ignore_patterns

DASHBOARDS = 'dashboards'
UPLOAD = 'upload'
STATIC = 'static'
WIDGETS = 'widgets'
BASEHTML = 'base.html'


#TODO
@click.command()
def update_data():
  pass


@click.command()
def compile():
  '''Templates dashboards and copies dashboards widgets, datafiles, and staticfiles to upload/'''

  base_name = path.join(STATIC, BASEHTML)
  base = open(base_name).read()

  #Get all dashes (in dashboards/)
  for dash in listdir(DASHBOARDS):
    dashbody = open(dash).read()

    #Write each dash to upload/<dashname>
    final_dash = path.join(UPLOAD, path.basename(dash))
    open(final_dash, 'w+').write(base.replace('{{ DASHBOARD GOES HERE }}', dashbody))

  #Copy widgets and static to upload/
  #Skip base.html since it's just a template
  copytree(STATIC, path.join(UPLOAD, STATIC), ignore=ignore_patterns('base.html'))
  copytree(WIDGETS, path.join(UPLOAD, WIDGETS))


@click.command()
@click.argument('bucket', envvar='DASHBOARD_BUCKET')
def deploy(bucket):
  '''Uploads the contents of static/ to BUCKET. 

  BUCKET can be set using the environment variable DASHBOARD_BUCKET.
  '''

  s3 = boto.connect_s3()
  bucket = s3.get_bucket(bucket)

  for dirpath, dirnames, filenames in walk(UPLOAD):
    for fname in filenames:
      key = boto.s3.key.Key(bucket)
      key.key = '/'.join(splitpath(path.join(dirpath, fname))[1:])    #Hack off "uploads/" and reform path using '/'s
      key.set_contents_from_filename(path.join(dirpath, fname))



############ Helper Functions ############

def splitpath(filename):
  '''Safely split <filename> on the system's path separator. Uses os.path.split.'''

  head, tail = path.split(filename)
  results = [tail]

  while head:
    head, tail = path.split(head)
    print head, tail
    results.insert(0, tail)

  return results
