<?php

$content = file_get_contents("country.js");
$content = json_decode($content, true);
$data = array();
foreach ($content as $k=>$v)
{
    if (count($v["geometry"]["coordinates"]) == 1) {
        $data[] = array(
            0, $v["properties"]["name"], array(),$v["geometry"]["coordinates"]
        );
    } else {
        $val = array();
        foreach ($v["geometry"]["coordinates"] as $kk=>$vv) {
            $val[] = $vv[0];
        }
        $data[] = array(
            0, $v["properties"]["name"], array(),$val
        );
    }
}
var_dump(json_encode($data));
